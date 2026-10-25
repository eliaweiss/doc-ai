/**
 * MCP tools for "Import from folder", with an MCP Apps UI: find_documents_in_folder
 * returns the scan and the host renders an inline picker (picker.html) where the
 * user selects what to import. Hosts without MCP Apps get the same data as text,
 * and the model can call import_photos itself.
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeThumbnail } from "./eye";
import { getScan, isScannedPath, startScan, viewScan, type Scan } from "./scan";
import { importPhotos, listTargetFolders } from "./import";

const PICKER_URI = "ui://doc-ai/import-picker.html";
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
/** How long find_documents_in_folder waits before returning a running scan (the picker keeps polling) */
const WAIT_MS = 45_000;

let pickerHtml: string | null = null;

/**
 * picker.html with the MCP Apps client bundle inlined: hosts sandbox the UI,
 * so it can't load scripts from this server or a CDN.
 */
function getPickerHtml(): string {
  if (!pickerHtml) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const require = createRequire(import.meta.url);
    const bundlePath = require.resolve("@modelcontextprotocol/ext-apps/app-with-deps");
    // The bundle is an ES module ending in `export{a as B,...}`; turn that into a global
    const bundle = readFileSync(bundlePath, "utf8").replace(
      /export\s*\{([^}]*)\};?\s*$/,
      (_m, names: string) =>
        `globalThis.__mcpApps={${names
          .split(",")
          .map((part) => {
            const [local, exported] = part.trim().split(/\s+as\s+/);
            return `${exported ?? local}:${local}`;
          })
          .join(",")}};`
    );
    pickerHtml = readFileSync(path.join(here, "picker.html"), "utf8").replace(
      "/*__MCP_APPS_BUNDLE__*/",
      () => bundle.replace(/<\/script/gi, "<\\/script")
    );
  }
  return pickerHtml;
}

function errorResult(error: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
  };
}

async function scanResult(scan: Scan, includeScreenshots: boolean) {
  const view = viewScan(scan, { includeScreenshots });
  const folders = await listTargetFolders();
  let text: string;
  if (view.status === "running") {
    text = `Still sorting ${view.folder}: ${view.done} of ${view.total} photos. Call get_folder_scan with scanId "${view.scanId}" for the result.`;
  } else if (view.status === "error") {
    text = `Scan of ${view.folder} failed: ${view.error}`;
  } else {
    const lines = view.items.map(
      (it) =>
        `- ${it.relPath} (${it.category}, ${Math.round(it.confidence * 100)}%)` +
        (it.existingDocumentId ? ` already in doc-ai as ${it.existingDocumentId}` : "")
    );
    text =
      `Scanned ${view.folder}: ${view.total} photos, ${view.counts.receipt} receipts, ${view.counts.document} documents, ` +
      `${view.counts.screenshot} screenshots (${(view.elapsedMs / 1000).toFixed(1)} s).` +
      (view.truncated ? " Only the first photos were scanned (limit reached)." : "") +
      `\nThe user can pick which to import in the picker shown with this result; or call import_photos with absolute paths.` +
      `\nFolder: ${view.folder}\n${lines.join("\n")}`;
  }
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: {
      scan: view,
      folders,
      defaultFolderId: folders.find((f) => f.isRoot)?.id ?? null,
    },
  };
}

export function registerPhotoSortTools(server: McpServer, opts: { onEnqueued?: () => void }) {
  server.registerResource(
    "import-picker",
    PICKER_URI,
    { title: "doc-ai import picker", mimeType: RESOURCE_MIME_TYPE },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: getPickerHtml() }] })
  );

  server.registerTool(
    "find_documents_in_folder",
    {
      title: "Find receipts and documents in a folder",
      description:
        "Sort the photos in a local folder (subfolders included) with the on-device Eye model and find the receipts and " +
        "documents (also whiteboards and ID cards; screenshots if asked). Shows the user an inline picker where everything " +
        "found is selected and they choose what to import into doc-ai. Only photos (JPG, PNG, WebP, GIF, TIFF) for now, not PDFs. " +
        "The folder is never changed; importing copies the files.",
      inputSchema: {
        folder: z.string().describe("Absolute path of the folder to scan (~ is expanded), e.g. /Users/me/Pictures/2025"),
        includeScreenshots: z.boolean().optional().describe("Also list screenshots. Default false."),
      },
      _meta: { ui: { resourceUri: PICKER_URI }, "ui/resourceUri": PICKER_URI },
    },
    async ({ folder, includeScreenshots }) => {
      try {
        const scan = await startScan(folder);
        await Promise.race([scan.promise, new Promise((r) => setTimeout(r, WAIT_MS))]);
        return await scanResult(scan, includeScreenshots ?? false);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "get_folder_scan",
    {
      description: "Progress or result of a folder scan started by find_documents_in_folder.",
      inputSchema: { scanId: z.string(), includeScreenshots: z.boolean().optional() },
      _meta: { ui: { resourceUri: PICKER_URI, visibility: ["model", "app"] } },
    },
    async ({ scanId, includeScreenshots }) => {
      const scan = getScan(scanId);
      if (!scan) return errorResult(`Scan not found (scans are kept in memory): ${scanId}`);
      return scanResult(scan, includeScreenshots ?? false);
    }
  );

  server.registerTool(
    "get_photo_thumbnails",
    {
      description: "Small JPEG previews (base64) of scanned photos, for the import picker.",
      inputSchema: { scanId: z.string().optional(), paths: z.array(z.string()).max(24) },
      // Only the picker calls this; the model doesn't need the image bytes
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ paths }) => {
      const thumbnails = [];
      for (const file of paths) {
        if (!isScannedPath(file)) continue;
        try {
          thumbnails.push({ path: file, data: (await makeThumbnail(file, 200)).toString("base64") });
        } catch {
          // unreadable file: no preview
        }
      }
      return {
        content: [{ type: "text" as const, text: `${thumbnails.length} thumbnails` }],
        structuredContent: { thumbnails },
      };
    }
  );

  server.registerTool(
    "import_photos",
    {
      description:
        "Import photos into doc-ai: each file is copied into the watch folder, added to a doc-ai folder and queued for " +
        "classification and extraction. Files whose content is already in doc-ai are skipped. " +
        "Target: folderId, or folderName (found or created under the root), else the root folder.",
      inputSchema: {
        paths: z.array(z.string()).min(1).describe("Absolute paths, e.g. from find_documents_in_folder"),
        folderId: z.string().optional(),
        folderName: z.string().optional(),
      },
      _meta: { ui: { visibility: ["model", "app"] } },
    },
    async ({ paths, folderId, folderName }) => {
      try {
        const result = await importPhotos({ paths, folderId, folderName, onEnqueued: opts.onEnqueued });
        const text =
          `Imported ${result.imported.length} into "${result.folder.name}", skipped ${result.skipped.length} already in doc-ai` +
          (result.failed.length
            ? `, ${result.failed.length} failed:\n${result.failed.map((f) => `- ${f.path}: ${f.error}`).join("\n")}`
            : ".");
        return { content: [{ type: "text" as const, text }], structuredContent: { ...result } };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
