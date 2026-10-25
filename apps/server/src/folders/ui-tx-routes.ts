/**
 * Folder methods for the uiTx SDK (mini apps): listFolders and moveDocuments.
 *
 * zdocs' uiTx handlers (packages/srv) can't move a document's file in the
 * watch folder, so these two methods are answered here, in front of the
 * copied /api/ui-tx route, with the same helpers as the MCP folder tools.
 * Moves go through the document move route, so directory sync applies.
 * Every other method falls through to the zdocs route.
 */
import type { Hono } from "hono";
import { LOCAL_ORG_ID } from "@zdocs/db-schema";
import type { UiTxRequest, UiTxResponse } from "@zdocs/types";
import { listFoldersWithCounts, moveDocumentsToFolder, type ApiPost } from "./mcp-tools";

const METHODS = new Set(["listFolders", "moveDocuments"]);

export function mountUiTxFolderRoutes(app: Hono, api: ApiPost) {
  app.post("/api/ui-tx", async (c, next) => {
    const request: UiTxRequest | null = await c.req.raw.clone().json().catch(() => null);
    if (!request || !METHODS.has(request.type)) return next();

    const reply = (body: Omit<UiTxResponse, "type" | "requestId">, status = 200) =>
      c.json({ type: "UITX_RESPONSE", requestId: request.requestId, ...body } as UiTxResponse, status as 200);

    const payload = (request.payload ?? {}) as { orgId?: string; documentIds?: unknown; folderId?: unknown };
    if (payload.orgId !== LOCAL_ORG_ID) {
      return reply({ ok: false, error: { code: "PERMISSION_DENIED", message: "Unknown organization" } }, 403);
    }

    try {
      if (request.type === "listFolders") {
        return reply({ ok: true, result: { folders: await listFoldersWithCounts() } });
      }
      const { documentIds, folderId } = payload;
      if (!Array.isArray(documentIds) || !documentIds.length || typeof folderId !== "string") {
        return reply({ ok: false, error: { code: "VALIDATION_ERROR", message: "documentIds (non-empty array) and folderId are required" } });
      }
      return reply({ ok: true, result: await moveDocumentsToFolder(api, documentIds.map(String), folderId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply({ ok: false, error: { code: message.includes("not found") ? "NOT_FOUND" : "INTERNAL_ERROR", message } });
    }
  });
}
