/**
 * HTTP API for "Import from folder" (mounted under /api/local/photo-sort):
 *
 * - GET  /dirs?dir=…        subfolders of a folder, for the folder browser
 * - POST /scan {folder, reuse?}  start a scan → scan view. When the folder has a saved scan
 *                           and `reuse` is not given → { savedScan } so the UI can ask;
 *                           reuse: true loads the saved scan, false scans again
 * - GET  /scan/:id          poll a scan (?screenshots=1 adds screenshots, ?all=1 every photo)
 * - GET  /thumb?path=…      JPEG preview of a scanned photo
 * - GET  /folders           doc-ai folders to import into
 * - POST /import {paths, folderId?, folderName?}
 */
import { Hono } from "hono";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { makeThumbnail } from "./eye";
import {
  ScanError,
  getSavedScanInfo,
  getScan,
  isScannedPath,
  resolveFolder,
  reuseSavedScan,
  startScan,
  viewScan,
} from "./scan";
import { ImportError, importPhotos, listTargetFolders } from "./import";

export function createPhotoSortApi(opts: { onEnqueued?: () => void }) {
  const api = new Hono();

  api.get("/dirs", async (c) => {
    const dir = resolveFolder(c.req.query("dir") || os.homedir());
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
    if (!entries) return c.json({ error: `Cannot read ${dir}` }, 400);
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
    const parent = path.dirname(dir);
    return c.json({ dir, parent: parent === dir ? null : parent, dirs });
  });

  api.post("/scan", async (c) => {
    const { folder, reuse } = await c.req.json();
    try {
      if (reuse === undefined) {
        const savedScan = await getSavedScanInfo(String(folder ?? ""));
        if (savedScan) return c.json({ savedScan });
      }
      const scan = reuse === true ? await reuseSavedScan(String(folder ?? "")) : await startScan(String(folder ?? ""));
      return c.json(viewScan(scan));
    } catch (error) {
      if (error instanceof ScanError) return c.json({ error: error.message }, 400);
      throw error;
    }
  });

  api.get("/scan/:id", (c) => {
    const scan = getScan(c.req.param("id"));
    if (!scan) return c.json({ error: "Scan not found" }, 404);
    return c.json(
      viewScan(scan, { includeScreenshots: c.req.query("screenshots") === "1", includeAll: c.req.query("all") === "1" })
    );
  });

  api.get("/thumb", async (c) => {
    const file = c.req.query("path") ?? "";
    // Only photos a scan returned, so this can't be used to read arbitrary files
    if (!isScannedPath(file)) return c.json({ error: "Not found" }, 404);
    const jpeg = await makeThumbnail(file);
    return c.body(new Uint8Array(jpeg), 200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    });
  });

  api.get("/folders", async (c) => c.json({ folders: await listTargetFolders() }));

  api.post("/import", async (c) => {
    const { paths, folderId, folderName } = await c.req.json();
    if (!Array.isArray(paths)) return c.json({ error: "paths must be an array" }, 400);
    try {
      return c.json(await importPhotos({ paths: paths.map(String), folderId, folderName, onEnqueued: opts.onEnqueued }));
    } catch (error) {
      if (error instanceof ImportError) return c.json({ error: error.message }, 400);
      throw error;
    }
  });

  return api;
}
