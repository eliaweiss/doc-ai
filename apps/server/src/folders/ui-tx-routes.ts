/**
 * Folder methods for the uiTx SDK (mini apps): listFolders, moveDocuments,
 * renameFolder, moveFolder and deleteFolder.
 *
 * zdocs' uiTx handlers (packages/srv) can't touch the watch folder, so these
 * methods are answered here, in front of the copied /api/ui-tx route, with the
 * same helpers as the MCP folder tools. Changes go through the folder and
 * document routes, so directory sync applies. Every other method falls
 * through to the zdocs route.
 */
import type { Hono } from "hono";
import { LOCAL_ORG_ID } from "@zdocs/db-schema";
import type { UiTxRequest, UiTxResponse } from "@zdocs/types";
import {
  deleteEmptyFolder,
  listFoldersWithCounts,
  moveDocumentsToFolder,
  moveFolder,
  renameFolder,
  type ApiPost,
} from "./mcp-tools";

class ValidationError extends Error {}

const str = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !v.trim()) throw new ValidationError(`${name} is required`);
  return v;
};

type Params = Record<string, unknown>;

const METHODS: Record<string, (api: ApiPost, p: Params) => Promise<unknown>> = {
  listFolders: async () => ({ folders: await listFoldersWithCounts() }),
  moveDocuments: (api, p) => {
    if (!Array.isArray(p.documentIds) || !p.documentIds.length) {
      throw new ValidationError("documentIds (non-empty array) and folderId are required");
    }
    return moveDocumentsToFolder(api, p.documentIds.map(String), str(p.folderId, "folderId"));
  },
  renameFolder: async (api, p) => ({ folder: await renameFolder(api, str(p.folderId, "folderId"), str(p.name, "name")) }),
  moveFolder: async (api, p) => ({
    folder: await moveFolder(api, str(p.folderId, "folderId"), p.parentId === undefined ? undefined : str(p.parentId, "parentId")),
  }),
  deleteFolder: (api, p) => deleteEmptyFolder(api, str(p.folderId, "folderId")),
};

export function mountUiTxFolderRoutes(app: Hono, api: ApiPost) {
  app.post("/api/ui-tx", async (c, next) => {
    const request: UiTxRequest | null = await c.req.raw.clone().json().catch(() => null);
    const method = request && Object.hasOwn(METHODS, request.type) ? METHODS[request.type] : null;
    if (!request || !method) return next();

    const reply = (body: Omit<UiTxResponse, "type" | "requestId">, status = 200) =>
      c.json({ type: "UITX_RESPONSE", requestId: request.requestId, ...body } as UiTxResponse, status as 200);

    const payload = (request.payload ?? {}) as Params;
    if (payload.orgId !== LOCAL_ORG_ID) {
      return reply({ ok: false, error: { code: "PERMISSION_DENIED", message: "Unknown organization" } }, 403);
    }

    try {
      return reply({ ok: true, result: await method(api, payload) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error instanceof ValidationError ? "VALIDATION_ERROR" : message.includes("not found") ? "NOT_FOUND" : "INTERNAL_ERROR";
      return reply({ ok: false, error: { code, message } });
    }
  });
}
