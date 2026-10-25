/**
 * Folder watcher: new or changed files in DOC_AI_WATCH_DIR become documents
 * and are queued for classification (replaces zdocs' upload + upload-complete route).
 *
 * - Waits for the file size to settle (Google Drive "mirror files" writes in chunks).
 * - Dedupe by MD5 content hash, like zdocs: one document per content.
 * - A known hash at a new path is treated as a rename/move.
 * - Deletions are only logged for now (documents are kept).
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import chokidar from "chokidar";
import {
  LOCAL_ORG_ID,
  createDocumentForOrg,
  enqueueDocument,
  findDocumentByContentHashForOrg,
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
  rootFolderId: string;
  onEnqueued?: () => void;
}

export async function ingestFile(absPath: string, opts: WatcherOptions): Promise<void> {
  const rel = path.relative(opts.watchDir, absPath);
  const base = path.basename(absPath);
  const ext = path.extname(base).slice(1).toLowerCase();
  if (isIgnoredName(base) || !SUPPORTED_EXTENSIONS.has(ext)) return;

  const buffer = await fs.readFile(absPath);
  if (buffer.length === 0) return;
  const contentHash = md5(buffer);
  const fileName = base.slice(0, base.length - ext.length - 1);

  const sameContent = await findDocumentByContentHashForOrg(LOCAL_ORG_ID, contentHash);
  if (sameContent) {
    const sourcePath = (sameContent.metadata as { sourcePath?: string } | null)?.sourcePath;
    if (sourcePath !== rel) {
      // Same bytes at a new path: follow the file (rename / move inside the folder)
      await updateDocumentStorageForOrg(LOCAL_ORG_ID, sameContent.id, {
        // Converted spreadsheets keep pointing at their CSV in the cache dir
        ...(sameContent.s3Bucket === LOCAL_BUCKET ? { s3Key: rel } : {}),
        fileName,
        metadata: { ...(sameContent.metadata ?? {}), sourcePath: rel },
      });
      console.log(`[Watcher] ${rel}: same content as document ${sameContent.id}, path updated`);
    }
    return;
  }

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
    folderId: opts.rootFolderId,
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

export function startWatcher(opts: WatcherOptions) {
  const cacheDir = getCacheDir();
  const watcher = chokidar.watch(opts.watchDir, {
    ignoreInitial: false,
    ignored: (p) => isIgnoredName(path.basename(p)) || p.startsWith(cacheDir),
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 250 },
  });

  // Serialize ingestion so hash-dedupe checks don't race each other
  let chain = Promise.resolve();
  const enqueue = (p: string) => {
    chain = chain
      .then(() => ingestFile(p, opts))
      .catch((error) => console.error(`[Watcher] Failed to ingest ${p}:`, error));
  };

  watcher.on("add", enqueue);
  watcher.on("change", enqueue);
  watcher.on("unlink", (p) =>
    console.log(`[Watcher] ${path.relative(opts.watchDir, p)} removed (document kept)`)
  );
  watcher.on("ready", () => console.log(`[Watcher] Watching ${opts.watchDir}`));
  watcher.on("error", (error) => console.error("[Watcher] Error:", error));

  return watcher;
}
