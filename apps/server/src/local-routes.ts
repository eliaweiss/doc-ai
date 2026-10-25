/**
 * Local replacements for zdocs routes that depend on S3 / Lambda, keeping the
 * request/response contract the zdocs client expects:
 *
 * - POST /api/uploads/aws            → document row + a local PUT URL (instead of a presigned S3 URL)
 * - PUT  /api/uploads/local/:id      → writes the file into the watch folder
 * - POST /api/uploads/:id/complete   → finishIngest (size check, XLSX→CSV, CLASSIFY job)
 * - GET  /api/uploads/:id/:fileName  → file bytes for the viewer
 * - POST /api/org/:orgId/documents/:documentId/extract → re-queue in the local worker
 *
 * Plus empty answers for zdocs features the shared UI shell still calls
 * (analytics), so pages load without errors.
 */
import type { Hono } from "hono";
import { promises as fs } from "fs";
import path from "path";
import {
  LOCAL_ORG_ID,
  createDocumentForOrg,
  findDocumentByContentHashForOrg,
  getDocumentById,
  getFolderForOrg,
  getRootFolderForOrg,
} from "@zdocs/db-schema";
import {
  LOCAL_BUCKET,
  FileSizeLimitError,
  fetchDocumentFromS3,
  getConfig,
  getContentTypeFromExtension,
  resolveDocumentPath,
} from "@zdocs/srv";
import { finishIngest, SUPPORTED_EXTENSIONS } from "./watcher";
import { reprocessDocument } from "./services";
import { folderRelDir, freeRelPath as freeRelPathInWatchDir } from "./folder-sync";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function safeName(name: string): string {
  return path.basename(name).replace(/[/\\:*?"<>|\x00-\x1f]/g, "_");
}

/** Unused relative path "<subdir>/<name>", "<subdir>/<name> (1)", ... in the watch folder */
export async function freeRelPath(watchDir: string, subdir: string, name: string): Promise<string> {
  return freeRelPathInWatchDir(watchDir, path.join(subdir, name));
}

export function mountLocalRoutes(app: Hono, opts: { onEnqueued?: () => void }) {
  app.post("/api/uploads/aws", async (c) => {
    const { watchDir } = getConfig();
    if (!watchDir) return c.json({ message: "DOC_AI_WATCH_DIR is not set" }, 400);

    const { md5Hash, fileName, fileSizeBytes, contentType, folderId, isTest } = await c.req.json();
    if (typeof fileSizeBytes !== "number" || fileSizeBytes > MAX_UPLOAD_BYTES) {
      return c.json({ message: "Missing or too large file size" }, 400);
    }
    const name = safeName(fileName || "document");
    const ext = path.extname(name).slice(1).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return c.json({ message: `Unsupported file type: .${ext}` }, 400);
    }

    // Same content already known: point the client at the existing document
    const existing = md5Hash ? await findDocumentByContentHashForOrg(LOCAL_ORG_ID, md5Hash) : null;
    if (existing) return c.json({ uploadUrl: null, key: existing.s3Key, documentId: existing.id });

    const folder = folderId ? await getFolderForOrg(LOCAL_ORG_ID, folderId) : null;
    const root = await getRootFolderForOrg(LOCAL_ORG_ID);
    const targetFolder = folder ?? root;
    if (!targetFolder) return c.json({ message: "No root folder" }, 500);

    // The folder's directory in the watch folder (root folder = watch folder itself)
    const rel = await freeRelPathInWatchDir(watchDir, path.join(await folderRelDir(targetFolder.id), name));

    const document = await createDocumentForOrg(LOCAL_ORG_ID, {
      folderId: targetFolder.id,
      s3Key: rel,
      s3Bucket: LOCAL_BUCKET,
      s3Region: "local",
      contentHash: md5Hash ?? null,
      fileName: path.basename(rel, path.extname(rel)),
      fileExtension: ext,
      contentType: contentType || getContentTypeFromExtension(name),
      isTest: isTest ?? false,
      metadata: { sourcePath: rel },
    });

    return c.json({ uploadUrl: `/api/uploads/local/${document.id}`, key: rel, documentId: document.id });
  });

  app.put("/api/uploads/local/:id", async (c) => {
    const document = await getDocumentById(c.req.param("id"));
    if (!document || document.uploadComplete || document.s3Bucket !== LOCAL_BUCKET) {
      return c.json({ message: "Upload not found" }, 404);
    }
    const buffer = Buffer.from(await c.req.arrayBuffer());
    if (buffer.length > MAX_UPLOAD_BYTES) return c.json({ message: "File too large" }, 413);
    const target = resolveDocumentPath(document.s3Key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return c.body(null, 200);
  });

  app.post("/api/uploads/:id/complete", async (c) => {
    const document = await getDocumentById(c.req.param("id"));
    if (!document) return c.json({ error: "Document not found" }, 404);
    const url = `/api/uploads/${document.id}/${encodeURIComponent(document.fileName ?? "file")}`;
    if (document.uploadComplete) return c.json({ message: "Upload complete", url });

    try {
      const buffer = await fetchDocumentFromS3(document.s3Bucket, document.s3Key);
      await finishIngest(document, buffer, document.s3Key, opts.onEnqueued);
    } catch (error) {
      if (error instanceof FileSizeLimitError) return c.json({ error: error.message }, 413);
      throw error;
    }
    return c.json({ message: "Upload complete", url });
  });

  app.get("/api/uploads/:id/:fileName", async (c) => {
    const document = await getDocumentById(c.req.param("id"));
    if (!document) return c.json({ error: "Document not found" }, 404);
    const buffer = await fetchDocumentFromS3(document.s3Bucket, document.s3Key);
    return c.body(new Uint8Array(buffer), 200, {
      "Content-Type": document.contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    });
  });

  app.post("/api/org/:orgId/documents/:documentId/extract", async (c) => {
    const documentId = c.req.param("documentId");
    const result = await reprocessDocument(documentId, opts.onEnqueued);
    return c.json({
      success: true,
      documentId,
      queued: result.queued,
      mode: "vercel",
      message: result.queued ? "Extraction queued" : "Document is already being processed",
    });
  });

  app.all("/api/user-journey-events", (c) => c.json({ success: true }));
  // Settings page asks for a webhook URL / inbound email address; neither exists locally
  app.post("/api/org/:orgId/webhook/generate", (c) => c.json({ organization: null }));
  app.post("/api/org/:orgId/email/generate", (c) => c.json({ organization: null }));
}
