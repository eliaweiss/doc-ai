/**
 * Import photos picked from a scan into doc-ai. Same path as a UI upload
 * (local-routes POST /api/uploads/aws + complete): the document row is created
 * in the target folder, the file is copied into the watch folder (the source
 * folder is never changed) and a CLASSIFY job is queued.
 */
import { promises as fs } from "fs";
import path from "path";
import {
  LOCAL_ORG_ID,
  createDocumentForOrg,
  createFolder,
  findDocumentByContentHashForOrg,
  getFolderForOrg,
  getFoldersByOrgId,
  getRootFolderForOrg,
} from "@zdocs/db-schema";
import { LOCAL_BUCKET, getConfig, getContentTypeFromExtension, resolveDocumentPath } from "@zdocs/srv";
import { finishIngest, md5 } from "../watcher";
import { freeRelPath, safeName } from "../local-routes";
import { PHOTO_EXTENSIONS } from "./eye";

export class ImportError extends Error {}

export interface ImportResult {
  folder: { id: string; name: string };
  imported: { path: string; documentId: string; savedAs: string }[];
  /** Same content already in doc-ai */
  skipped: { path: string; documentId: string }[];
  failed: { path: string; error: string }[];
}

/** Target UI folder: by id, else by name (created under the root when missing), else the root */
async function resolveTargetFolder(folderId?: string | null, folderName?: string | null) {
  const root = await getRootFolderForOrg(LOCAL_ORG_ID);
  if (!root) throw new ImportError("No root folder");
  if (folderId) {
    const folder = await getFolderForOrg(LOCAL_ORG_ID, folderId);
    if (!folder) throw new ImportError(`Folder not found: ${folderId}`);
    return { folder, root };
  }
  const name = folderName?.trim();
  if (name) {
    const existing = (await getFoldersByOrgId(LOCAL_ORG_ID)).find(
      (f) => f.name.toLowerCase() === name.toLowerCase()
    );
    const folder = existing ?? (await createFolder({ orgId: LOCAL_ORG_ID, name, parentId: root.id }));
    return { folder, root };
  }
  return { folder: root, root };
}

export async function importPhotos(opts: {
  paths: string[];
  folderId?: string | null;
  folderName?: string | null;
  onEnqueued?: () => void;
}): Promise<ImportResult> {
  const { watchDir } = getConfig();
  if (!watchDir) throw new ImportError("No watch folder is set (Settings → Processing)");
  if (!opts.paths.length) throw new ImportError("No files to import");

  const { folder, root } = await resolveTargetFolder(opts.folderId, opts.folderName);
  // UI folders map to subfolders of the watch folder (root folder = watch folder itself)
  const subdir = folder.id === root.id ? "" : safeName(folder.name);
  const result: ImportResult = { folder: { id: folder.id, name: folder.name }, imported: [], skipped: [], failed: [] };

  for (const source of [...new Set(opts.paths)]) {
    try {
      if (!path.isAbsolute(source)) throw new ImportError("Path must be absolute");
      const name = safeName(path.basename(source));
      const ext = path.extname(name).slice(1).toLowerCase();
      if (!PHOTO_EXTENSIONS.has(ext)) throw new ImportError(`Not a supported photo: .${ext}`);

      const buffer = await fs.readFile(source);
      const contentHash = md5(buffer);
      const existing = await findDocumentByContentHashForOrg(LOCAL_ORG_ID, contentHash);
      if (existing) {
        result.skipped.push({ path: source, documentId: existing.id });
        continue;
      }

      const rel = await freeRelPath(watchDir, subdir, name);
      // Row first, with the hash: when the watcher sees the new file it finds this document
      const document = await createDocumentForOrg(LOCAL_ORG_ID, {
        folderId: folder.id,
        s3Key: rel,
        s3Bucket: LOCAL_BUCKET,
        s3Region: "local",
        contentHash,
        fileName: path.basename(rel, path.extname(rel)),
        fileExtension: ext,
        contentType: getContentTypeFromExtension(name),
        isTest: false,
        metadata: { sourcePath: rel, importedFrom: source },
      });
      const target = resolveDocumentPath(rel);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
      await finishIngest(document, buffer, rel, opts.onEnqueued);
      result.imported.push({ path: source, documentId: document.id, savedAs: rel });
    } catch (error) {
      result.failed.push({ path: source, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

/** UI folders, for the import target picker */
export async function listTargetFolders() {
  const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
  return folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, isRoot: f.isRoot }));
}
