/**
 * Folder ↔ directory sync for the UI: middleware around zdocs' folder and
 * document routes. The zdocs handler runs unchanged (database first), then the
 * matching change is applied to the watch folder:
 *
 * - create folder        → mkdir
 * - rename / move folder → move the directory (and repoint its documents)
 * - delete folder        → directory to the doc-ai trash; its documents and
 *                          subfolders are deleted too (zdocs left them orphaned)
 * - move document        → move its file into the new folder's directory
 * - delete document      → its file to the doc-ai trash (else the watcher would
 *                          import it again)
 *
 * Folder names that would map to an existing sibling directory are rejected.
 */
import type { Context, Hono, Next } from "hono";
import { promises as fs } from "fs";
import path from "path";
import {
  LOCAL_ORG_ID,
  deleteDocument,
  deleteFolder,
  getDocumentForOrg,
  getFoldersByOrgId,
  getRootFolderForOrg,
  listDocumentsInFoldersForOrg,
} from "@zdocs/db-schema";
import { getConfig } from "@zdocs/srv";
import {
  documentSourcePath,
  findSiblingByDirName,
  folderRelDirFrom,
  moveDirectory,
  moveToTrash,
  subtreeOf,
  syncDocumentFile,
} from "./folder-sync";

const ORG = "/api/org/:orgId";

async function responseJson(c: Context): Promise<Record<string, any> | null> {
  if (!c.res.ok) return null;
  return c.res.clone().json().catch(() => null);
}

function conflict(c: Context, name: string) {
  return c.json({ error: `A folder named "${name}" already exists here` }, 409);
}

/** Repoint every document under a folder after its directory moved */
async function resyncSubtree(folderId: string): Promise<void> {
  const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
  const ids = subtreeOf(folders, folderId).map((f) => f.id);
  for (const doc of await listDocumentsInFoldersForOrg(LOCAL_ORG_ID, ids)) {
    await syncDocumentFile(doc.id, folders);
  }
}

export function mountFolderSyncRoutes(app: Hono) {
  const guard = (fn: (c: Context, next: Next) => Promise<Response | void>) => async (c: Context, next: Next) => {
    if (!getConfig().watchDir) return next(); // no watch folder: database only, as in zdocs
    return fn(c, next);
  };

  app.post(`${ORG}/folders/create`, guard(async (c, next) => {
    const { name, parentId } = await c.req.json();
    const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
    const parent = parentId ?? (await getRootFolderForOrg(LOCAL_ORG_ID))?.id ?? null;
    if (typeof name === "string" && findSiblingByDirName(folders, parent, name)) return conflict(c, name);

    await next();
    const folder = (await responseJson(c))?.folder;
    if (!folder?.id || !folder.parentId) return;
    const rel = folderRelDirFrom(await getFoldersByOrgId(LOCAL_ORG_ID), folder.id);
    await fs.mkdir(path.join(getConfig().watchDir!, rel), { recursive: true });
  }));

  app.post(`${ORG}/folders/:folderId/rename`, guard(async (c, next) => {
    const folderId = c.req.param("folderId")!;
    const { name } = await c.req.json();
    const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return next();
    if (typeof name === "string" && findSiblingByDirName(folders, folder.parentId, name, folderId)) {
      return conflict(c, name);
    }
    const oldRel = folderRelDirFrom(folders, folderId);

    await next();
    if (!(await responseJson(c))) return;
    await moveDirectory(oldRel, folderRelDirFrom(await getFoldersByOrgId(LOCAL_ORG_ID), folderId));
    await resyncSubtree(folderId);
  }));

  app.post(`${ORG}/folders/:folderId/move`, guard(async (c, next) => {
    const folderId = c.req.param("folderId")!;
    const { parentId } = await c.req.json();
    const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return next();
    if (parentId && subtreeOf(folders, folderId).some((f) => f.id === parentId)) {
      return c.json({ error: "Cannot move a folder into itself" }, 400);
    }
    const newParent = parentId ?? (await getRootFolderForOrg(LOCAL_ORG_ID))?.id ?? null;
    if (findSiblingByDirName(folders, newParent, folder.name, folderId)) return conflict(c, folder.name);
    const oldRel = folderRelDirFrom(folders, folderId);

    await next();
    if (!(await responseJson(c))) return;
    await moveDirectory(oldRel, folderRelDirFrom(await getFoldersByOrgId(LOCAL_ORG_ID), folderId));
    await resyncSubtree(folderId);
  }));

  app.post(`${ORG}/folders/:folderId/delete`, guard(async (c, next) => {
    const folderId = c.req.param("folderId")!;
    const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
    const subtree = subtreeOf(folders, folderId);
    const rel = folderRelDirFrom(folders, folderId);

    await next();
    if (!(await responseJson(c)) || !rel) return;
    await moveToTrash(rel);
    for (const doc of await listDocumentsInFoldersForOrg(LOCAL_ORG_ID, subtree.map((f) => f.id))) {
      await deleteDocument(doc.id, LOCAL_ORG_ID);
    }
    for (const f of subtree.slice(1)) await deleteFolder(f.id, LOCAL_ORG_ID);
  }));

  app.post(`${ORG}/documents/:documentId/move`, guard(async (c, next) => {
    await next();
    if (await responseJson(c)) await syncDocumentFile(c.req.param("documentId")!);
  }));

  app.post(`${ORG}/documents/:documentId/delete`, guard(async (c, next) => {
    const document = await getDocumentForOrg(LOCAL_ORG_ID, c.req.param("documentId")!);
    const rel = document ? documentSourcePath(document) : null;

    await next();
    if (!(await responseJson(c)) || !rel || !document) return;
    // Keep the file if another live document still uses it
    const others = await listDocumentsInFoldersForOrg(LOCAL_ORG_ID, [document.folderId ?? ""]);
    if (others.some((d) => d.id !== document.id && documentSourcePath(d) === rel)) return;
    await moveToTrash(rel);
  }));
}
