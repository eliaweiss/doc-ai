/**
 * Local HTTP API for the web UI. No auth: the server binds to 127.0.0.1.
 */
import { Hono } from "hono";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_ORG_ID, listDocumentsForOrg } from "@zdocs/db-schema";
import { fetchDocumentFromS3, getConfig, resolveDocumentPath } from "@zdocs/srv";
import {
  getDocumentDetail,
  getDocumentType,
  getStatus,
  listDocumentTypes,
  reprocessDocument,
} from "./services";
import { SettingsError, getPublicSettings, saveSettings, testConnection } from "./settings";
import { createPhotoSortApi } from "./photo-sort/routes";

export function createApi(opts: { onEnqueued?: () => void; onWatchDirChanged?: () => Promise<void> }) {
  const api = new Hono();

  api.get("/settings", async (c) => c.json(await getPublicSettings()));

  api.post("/settings", async (c) => {
    try {
      const { watchDirChanged } = await saveSettings(await c.req.json());
      if (watchDirChanged) await opts.onWatchDirChanged?.();
      return c.json(await getPublicSettings());
    } catch (error) {
      if (error instanceof SettingsError) return c.json({ error: error.message }, 400);
      throw error;
    }
  });

  api.post("/settings/test", async (c) => c.json(await testConnection()));

  api.get("/status", async (c) => c.json(await getStatus()));

  api.get("/documents", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") || 200), 1000);
    const offset = Number(c.req.query("offset") || 0);
    const documents = await listDocumentsForOrg(LOCAL_ORG_ID, {
      limit,
      offset,
      sortByUploadDate: true,
    });
    return c.json({ documents });
  });

  api.get("/documents/:id", async (c) => {
    const detail = await getDocumentDetail(c.req.param("id"));
    if (!detail) return c.json({ error: "Not found" }, 404);
    const type = detail.document.docType ? await getDocumentType(detail.document.docType) : null;
    return c.json({ ...detail, documentType: type });
  });

  // Original file, for the preview pane
  api.get("/documents/:id/file", async (c) => {
    const detail = await getDocumentDetail(c.req.param("id"));
    if (!detail) return c.json({ error: "Not found" }, 404);
    const { document } = detail;
    const sourcePath = (document.metadata as { sourcePath?: string } | null)?.sourcePath;
    const buffer = sourcePath
      ? await fs.readFile(resolveDocumentPath(sourcePath))
      : await fetchDocumentFromS3(document.s3Bucket, document.s3Key);
    const fileName = path.basename(sourcePath || `${document.fileName}.${document.fileExtension}`);
    return c.body(new Uint8Array(buffer), 200, {
      "Content-Type": document.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
    });
  });

  api.post("/documents/:id/reprocess", async (c) =>
    c.json(await reprocessDocument(c.req.param("id"), opts.onEnqueued))
  );

  api.get("/document-types", async (c) => c.json(await listDocumentTypes()));

  // Import from folder: Eye sorts the photos, the user picks which to import
  api.route("/photo-sort", createPhotoSortApi({ onEnqueued: opts.onEnqueued }));

  // Upload = drop the file into the watched folder; the watcher does the rest
  api.post("/upload", async (c) => {
    const { watchDir } = getConfig();
    if (!watchDir) return c.json({ error: "DOC_AI_WATCH_DIR is not set" }, 400);
    const body = await c.req.parseBody({ all: true });
    const files = ([] as unknown[]).concat(body.file ?? []).filter((f): f is File => f instanceof File);
    const saved: string[] = [];
    for (const file of files) {
      const name = path.basename(file.name).replace(/[/\\]/g, "_");
      let target = path.join(watchDir, name);
      for (let i = 1; await fs.stat(target).then(() => true, () => false); i++) {
        const ext = path.extname(name);
        target = path.join(watchDir, `${path.basename(name, ext)} (${i})${ext}`);
      }
      await fs.writeFile(target, new Uint8Array(await file.arrayBuffer()));
      saved.push(path.relative(watchDir, target));
    }
    return c.json({ saved });
  });

  return api;
}
