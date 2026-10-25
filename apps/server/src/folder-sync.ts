/**
 * Folder ↔ directory sync: the watch folder's directory tree is the source of
 * truth for doc-ai folders.
 *
 * - The root folder is the watch folder itself; a folder's directory is the
 *   path of its (sanitized) names below the root.
 * - A document's file lives in its folder's directory. When a document's
 *   folder changes (UI move, classification routing), its file is moved.
 * - Files removed through the UI go to `<data dir>/trash/...`, never deleted.
 */
import { promises as fs } from "fs";
import path from "path";
import {
  LOCAL_ORG_ID,
  createFolder,
  getDocumentForOrg,
  getFoldersByOrgId,
  getRootFolderForOrg,
  updateDocumentStorageForOrg,
} from "@zdocs/db-schema";
import { LOCAL_BUCKET, getConfig } from "@zdocs/srv";
import type { Document, Folder } from "@zdocs/types";

/** Directory name for a folder name (what the 1flow import and uploads use) */
export function folderDirName(name: string): string {
  return name.normalize("NFC").replace(/[/\\:*?"<>|\x00-\x1f]/g, "_").trim().slice(0, 120) || "folder";
}

function requireWatchDir(): string {
  const { watchDir } = getConfig();
  if (!watchDir) throw new Error("No watch folder set");
  return watchDir;
}

export async function exists(p: string): Promise<boolean> {
  return fs.stat(p).then(() => true, () => false);
}

/** Directory of a folder relative to the watch folder ("" for the root) */
export function folderRelDirFrom(folders: Folder[], folderId: string): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current && current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(folderDirName(current.name));
    current = byId.get(current.parentId);
  }
  return parts.join(path.sep);
}

export async function folderRelDir(folderId: string): Promise<string> {
  return folderRelDirFrom(await getFoldersByOrgId(LOCAL_ORG_ID), folderId);
}

/** The folder and all its descendants */
export function subtreeOf(folders: Folder[], folderId: string): Folder[] {
  const out: Folder[] = [];
  const queue = [folderId];
  while (queue.length) {
    const id = queue.shift()!;
    const folder = folders.find((f) => f.id === id);
    if (folder) out.push(folder);
    queue.push(...folders.filter((f) => f.parentId === id).map((f) => f.id));
  }
  return out;
}

/** A live sibling (other than `exceptId`) that maps to the same directory name */
export function findSiblingByDirName(
  folders: Folder[],
  parentId: string | null,
  name: string,
  exceptId?: string
): Folder | undefined {
  const dir = folderDirName(name).toLowerCase();
  return folders.find(
    (f) => f.parentId === parentId && f.id !== exceptId && folderDirName(f.name).toLowerCase() === dir
  );
}

/** Existing folder for a directory below the watch folder (no creation) */
export async function findFolderForRelDir(relDir: string): Promise<Folder | null> {
  const root = await getRootFolderForOrg(LOCAL_ORG_ID);
  if (!root) return null;
  const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
  let parent: Folder = root;
  for (const segment of relDir.normalize("NFC").split(path.sep).filter((s) => s && s !== ".")) {
    const next =
      folders.find((f) => f.parentId === parent.id && folderDirName(f.name) === segment) ??
      findSiblingByDirName(folders, parent.id, segment);
    if (!next) return null;
    parent = next;
  }
  return parent;
}

/**
 * Folder for a directory below the watch folder, creating missing folders.
 * Matching is by directory name (case-insensitive, as on macOS).
 */
export async function ensureFolderForRelDir(relDir: string): Promise<Folder> {
  const root = await getRootFolderForOrg(LOCAL_ORG_ID);
  if (!root) throw new Error("No root folder");
  // NFC: macOS may return decomposed names (e.g. "SÃO") for directories
  const segments = relDir.normalize("NFC").split(path.sep).filter((s) => s && s !== ".");
  if (segments.length === 0) return root;

  const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
  let parent = root;
  for (const segment of segments) {
    const existing =
      folders.find((f) => f.parentId === parent.id && folderDirName(f.name) === segment) ??
      findSiblingByDirName(folders, parent.id, segment);
    if (existing) {
      parent = existing;
      continue;
    }
    const created = await createFolder({ orgId: LOCAL_ORG_ID, name: segment, parentId: parent.id });
    folders.push(created);
    console.log(`[Folders] Created folder "${segment}" for ${relDir}`);
    parent = created;
  }
  return parent;
}

/** Where a document's file currently is, relative to the watch folder */
export function documentSourcePath(document: Document): string | null {
  const sourcePath = (document.metadata as { sourcePath?: string } | null)?.sourcePath;
  if (sourcePath) return sourcePath;
  return document.s3Bucket === LOCAL_BUCKET ? document.s3Key : null;
}

async function setDocumentPath(document: Document, rel: string): Promise<void> {
  await updateDocumentStorageForOrg(LOCAL_ORG_ID, document.id, {
    // Converted spreadsheets keep pointing at their CSV in the cache dir
    ...(document.s3Bucket === LOCAL_BUCKET ? { s3Key: rel } : {}),
    metadata: { ...((document.metadata as Record<string, unknown> | null) ?? {}), sourcePath: rel },
  });
}

/** Unused path: "<dir>/<name>", "<dir>/<name> (1)", ... */
export async function freeRelPath(watchDir: string, rel: string): Promise<string> {
  const dir = path.dirname(rel) === "." ? "" : path.dirname(rel);
  const ext = path.extname(rel);
  const stem = path.basename(rel, ext);
  for (let i = 0; ; i++) {
    const candidate = path.join(dir, i === 0 ? `${stem}${ext}` : `${stem} (${i})${ext}`);
    if (!(await exists(path.join(watchDir, candidate)))) return candidate;
  }
}

/**
 * Put a document's file in its folder's directory. Also repairs the stored
 * path when the file was already moved (e.g. its whole directory was renamed).
 */
export async function syncDocumentFile(documentId: string, folders?: Folder[]): Promise<void> {
  const watchDir = requireWatchDir();
  const document = await getDocumentForOrg(LOCAL_ORG_ID, documentId);
  if (!document) return;
  const current = documentSourcePath(document);
  if (!current) return;

  const dir = folderRelDirFrom(folders ?? (await getFoldersByOrgId(LOCAL_ORG_ID)), document.folderId ?? "");
  const expected = path.join(dir, path.basename(current));
  if (expected.normalize("NFC") === current.normalize("NFC")) return;

  const src = path.join(watchDir, current);
  const dst = path.join(watchDir, expected);
  if (!(await exists(src))) {
    if (await exists(dst)) await setDocumentPath(document, expected); // already moved with its directory
    return;
  }
  const target = (await exists(dst)) ? await freeRelPath(watchDir, expected) : expected;
  await fs.mkdir(path.dirname(path.join(watchDir, target)), { recursive: true });
  // Store the new path first, so the watcher recognizes the file at its new place
  await setDocumentPath(document, target);
  await fs.rename(src, path.join(watchDir, target));
  console.log(`[Folders] Moved ${current} → ${target}`);
}

/** Move a directory below the watch folder (folder renamed / moved in the UI). */
export async function moveDirectory(oldRel: string, newRel: string): Promise<void> {
  if (!oldRel || oldRel === newRel) return;
  const watchDir = requireWatchDir();
  const src = path.join(watchDir, oldRel);
  const dst = path.join(watchDir, newRel);
  if (!(await exists(src))) {
    await fs.mkdir(dst, { recursive: true });
    return;
  }
  await fs.mkdir(path.dirname(dst), { recursive: true });
  if (await exists(dst)) {
    // Target directory already there (e.g. case-only rename on macOS): merge into it
    if (src.toLowerCase() === dst.toLowerCase()) {
      const tmp = `${src}.doc-ai-rename-${Date.now()}`;
      await fs.rename(src, tmp);
      await fs.rename(tmp, dst);
    } else {
      for (const entry of await fs.readdir(src)) {
        await fs.rename(path.join(src, entry), path.join(dst, entry));
      }
      await fs.rmdir(src).catch(() => {});
    }
  } else {
    await fs.rename(src, dst);
  }
  console.log(`[Folders] Moved directory ${oldRel} → ${newRel}`);
}

/** Move a file or directory out of the watch folder into the doc-ai trash. */
export async function moveToTrash(rel: string): Promise<string | null> {
  const watchDir = requireWatchDir();
  const src = path.join(watchDir, rel);
  if (!rel || !(await exists(src))) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dst = path.join(getConfig().dataDir, "trash", stamp, rel);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.rename(src, dst).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== "EXDEV") throw error;
    await fs.cp(src, dst, { recursive: true }); // data folder on another volume
    await fs.rm(src, { recursive: true, force: true });
  });
  console.log(`[Folders] Moved ${rel} to trash: ${dst}`);
  return dst;
}
