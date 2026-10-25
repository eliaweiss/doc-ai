/**
 * Folder watcher: new or changed files in DOC_AI_WATCH_DIR become documents
 * and are queued for classification (replaces zdocs' upload + upload-complete route).
 *
 * - Waits for the file size to settle (Google Drive "mirror files" writes in chunks).
 * - Dedupe by MD5 content hash, like zdocs: one document per content.
 * - A known hash at a new path is treated as a rename/move.
 * - The directory tree is the folder tree: a file's folder is its directory
 *   (missing folders are created), new directories become folders, and
 *   directories removed on disk drop their folder once it's empty.
 * - File deletions are only logged for now (documents are kept).
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import chokidar from "chokidar";
import {
  LOCAL_ORG_ID,
  createDocumentForOrg,
  deleteFolder,
  getFoldersByOrgId,
  listDocumentsInFoldersForOrg,
  updateDocumentForOrg,
  enqueueDocument,
  findDocumentsByContentHashForOrg,
  findDocumentByS3KeyForOrg,
  hasActiveJob,
  markDocumentUploadComplete,
  updateDocumentStorageForOrg,
  setDocumentExtractionFailed,
} from "@zdocs/db-schema";
import {
  CACHE_BUCKET,
  LOCAL_BUCKET,
  FileSizeLimitError,
  getCacheDir,
  getContentTypeFromExtension,
  isBinarySpreadsheetFile,
  saveToCache,
  spreadsheetToText,
  validateDocumentUploadSize,
} from "@zdocs/srv";
import { ensureFolderForRelDir, exists, findFolderForRelDir } from "./folder-sync";

export const SUPPORTED_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "jfif", "png", "gif", "webp", "tiff", "tif",
  "csv", "xls", "xlsx", "xlsm",
]);

/** Temp / placeholder files written by browsers, Office and sync clients */
function isIgnoredName(name: string): boolean {
  return (
    name.startsWith(".") ||
    name.startsWith("~$") ||
    /\.(tmp|part|crdownload|download|gdoc|gsheet|gslides)$/i.test(name)
  );
}

export function md5(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

export interface WatcherOptions {
  watchDir: string;
  onEnqueued?: () => void;
}

export async function ingestFile(absPath: string, opts: WatcherOptions): Promise<void> {
  // NFC so paths match the stored ones even when macOS reports decomposed names
  const rel = path.relative(opts.watchDir, absPath).normalize("NFC");
  const base = path.basename(absPath);
  const ext = path.extname(base).slice(1).toLowerCase();
  if (isIgnoredName(base) || !SUPPORTED_EXTENSIONS.has(ext)) return;

  const buffer = await fs.readFile(absPath);
  if (buffer.length === 0) return;
  const contentHash = md5(buffer);
  const fileName = base.slice(0, base.length - ext.length - 1);
  const folder = await ensureFolderForRelDir(path.dirname(rel));

  const sameContent = await findDocumentsByContentHashForOrg(LOCAL_ORG_ID, contentHash);
  const sourcePathOf = (d: (typeof sameContent)[number]) =>
    (d.metadata as { sourcePath?: string } | null)?.sourcePath?.normalize("NFC");
  // Already known at this path (also covers identical copies in several folders).
  // The directory decides the folder, e.g. after files were moved while doc-ai was off.
  const known = sameContent.find((d) => sourcePathOf(d) === rel);
  if (known) {
    if (known.folderId !== folder.id) {
      await updateDocumentForOrg(LOCAL_ORG_ID, known.id, { folderId: folder.id });
      console.log(`[Watcher] ${rel}: folder set from its directory`);
    }
    return;
  }

  // Same bytes at a new path, and one of the known copies is gone: it was renamed / moved
  for (const candidate of sameContent) {
    const oldPath = sourcePathOf(candidate);
    const stillThere = oldPath
      ? await fs.stat(path.join(opts.watchDir, oldPath)).then(() => true, () => false)
      : false;
    if (stillThere) continue;
    await updateDocumentStorageForOrg(LOCAL_ORG_ID, candidate.id, {
      // Converted spreadsheets keep pointing at their CSV in the cache dir
      ...(candidate.s3Bucket === LOCAL_BUCKET ? { s3Key: rel } : {}),
      fileName,
      metadata: { ...(candidate.metadata ?? {}), sourcePath: rel },
    });
    if (candidate.folderId !== folder.id) {
      await updateDocumentForOrg(LOCAL_ORG_ID, candidate.id, { folderId: folder.id });
    }
    console.log(`[Watcher] ${rel}: same content as document ${candidate.id}, path updated`);
    return;
  }
  // Otherwise it's an extra copy of a known file: it becomes its own document (as in zdocs)

  const atSamePath = await findDocumentByS3KeyForOrg(LOCAL_ORG_ID, rel);
  if (atSamePath) {
    // File content changed in place. v1: keep the old document, add a new one.
    console.log(`[Watcher] ${rel}: content changed, creating a new document`);
  }

  const contentType = getContentTypeFromExtension(base);
  const document = await createDocumentForOrg(LOCAL_ORG_ID, {
    contentType,
    s3Key: rel,
    s3Bucket: LOCAL_BUCKET,
    s3Region: "local",
    fileName,
    fileExtension: ext,
    contentHash,
    folderId: folder.id,
    isTest: false,
    metadata: { sourcePath: rel },
  });

  await finishIngest(document, buffer, rel, opts.onEnqueued);
}

/**
 * Shared by the watcher and the UI upload route: size check, spreadsheet
 * conversion, upload-complete flag and CLASSIFY job (zdocs' upload-complete route).
 */
export async function finishIngest(
  document: { id: string; contentType: string; contentHash: string | null; fileName: string | null; fileExtension: string | null },
  buffer: Buffer,
  rel: string,
  onEnqueued?: () => void
): Promise<void> {
  const contentType = document.contentType;
  const contentHash = document.contentHash ?? md5(buffer);
  const base = `${document.fileName}.${document.fileExtension}`;
  try {
    await validateDocumentUploadSize(buffer, contentType);
  } catch (error) {
    if (error instanceof FileSizeLimitError) {
      await markDocumentUploadComplete(document.id, true);
      await setDocumentExtractionFailed(LOCAL_ORG_ID, document.id, error.message, "classification");
      console.warn(`[Watcher] ${rel}: ${error.message}`);
      return;
    }
    throw error;
  }

  await markDocumentUploadComplete(document.id, true);

  // Same as zdocs' upload-complete route: XLS/XLSX are converted to CSV text.
  // The CSV goes to the cache dir; the user's folder is never written to.
  if (isBinarySpreadsheetFile(base, contentType)) {
    try {
      const csv = spreadsheetToText(buffer);
      const key = `converted/${contentHash}.csv`;
      await saveToCache(key, csv.toString("utf8"), "text/csv");
      await updateDocumentStorageForOrg(LOCAL_ORG_ID, document.id, {
        s3Key: key,
        s3Bucket: CACHE_BUCKET,
        contentType: "text/csv",
        fileExtension: "csv",
      });
    } catch (error) {
      console.error(`[Watcher] Failed to convert spreadsheet ${rel}:`, error);
    }
  }

  if (!(await hasActiveJob(document.id))) {
    const job = await enqueueDocument(LOCAL_ORG_ID, document.id, "CLASSIFY");
    console.log(`[Watcher] ${rel}: document ${document.id} queued (job ${job.id})`);
    onEnqueued?.();
  }
}

async function dropFolderIfGone(watchDir: string, relDir: string): Promise<void> {
  if (await exists(path.join(watchDir, relDir))) return;
  const folder = await findFolderForRelDir(relDir);
  if (!folder || !folder.parentId) return;
  const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
  if (folders.some((f) => f.parentId === folder.id)) return;
  if ((await listDocumentsInFoldersForOrg(LOCAL_ORG_ID, [folder.id])).length > 0) return;
  if (await deleteFolder(folder.id, LOCAL_ORG_ID)) {
    console.log(`[Watcher] ${relDir} removed on disk: folder "${folder.name}" deleted`);
  }
}

export function startWatcher(opts: WatcherOptions) {
  const cacheDir = getCacheDir();
  const watcher = chokidar.watch(opts.watchDir, {
    ignoreInitial: false,
    ignored: (p) => isIgnoredName(path.basename(p)) || p.startsWith(cacheDir),
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 250 },
  });

  // Serialize ingestion so hash-dedupe checks and folder creation don't race each other
  let chain = Promise.resolve();
  let closed = false;
  const serial = (label: string, fn: () => Promise<unknown>) => {
    if (closed) return;
    chain = chain
      .then(fn)
      .then(() => undefined)
      .catch((error) => console.error(`[Watcher] Failed: ${label}:`, error));
  };
  const enqueue = (p: string) => serial(p, () => ingestFile(p, opts));
  const rel = (p: string) => path.relative(opts.watchDir, p).normalize("NFC");

  watcher.on("add", enqueue);
  watcher.on("change", enqueue);
  watcher.on("addDir", (p) => {
    if (rel(p)) serial(p, () => ensureFolderForRelDir(rel(p)));
  });
  // A removed directory drops its folder once nothing is left in it. Wait a bit:
  // on a rename, the files' add/unlink events arrive after the unlinkDir.
  watcher.on("unlinkDir", (p) => {
    if (!rel(p)) return;
    setTimeout(() => serial(p, () => dropFolderIfGone(opts.watchDir, rel(p))), 5000);
  });
  watcher.on("unlink", (p) =>
    console.log(`[Watcher] ${path.relative(opts.watchDir, p)} removed (document kept)`)
  );
  watcher.on("ready", () => console.log(`[Watcher] Watching ${opts.watchDir}`));
  watcher.on("error", (error) => console.error("[Watcher] Error:", error));

  // Closing also waits for queued ingestion, so the database can be switched after it
  const closeWatcher = watcher.close.bind(watcher);
  return Object.assign(watcher, {
    close: async () => {
      closed = true;
      await closeWatcher();
      await chain;
    },
  });
}
