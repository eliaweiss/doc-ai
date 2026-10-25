/**
 * MCP tools for folders: list, create, rename, move, delete (empty only) and
 * moving documents between folders.
 *
 * Changes go through the same HTTP routes as the UI (via `api`), so the
 * folder ↔ directory sync in folder-routes.ts applies: directories in the
 * watch folder are created, renamed and moved with their folders, and moved
 * documents' files follow them.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  LOCAL_ORG_ID,
  getFoldersByOrgId,
  getRootFolderForOrg,
  listDocumentsInFoldersForOrg,
} from "@zdocs/db-schema";
import type { Folder } from "@zdocs/types";

/** POSTs a JSON body to an app route and returns the JSON response; throws its error message */
export type ApiPost = (path: string, body: unknown) => Promise<any>;

const ORG = `/api/org/${LOCAL_ORG_ID}`;

/** "My Drive/Receipts/2025" */
function folderPath(folders: Folder[], folderId: string): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  const seen = new Set<string>();
  for (let f = byId.get(folderId); f && !seen.has(f.id); f = f.parentId ? byId.get(f.parentId) : undefined) {
    seen.add(f.id);
    parts.unshift(f.name);
  }
  return parts.join("/");
}

function summary(folders: Folder[], folder: Folder) {
  return {
    id: folder.id,
    name: folder.name,
    path: folderPath(folders, folder.id),
    parentId: folder.parentId,
    isRoot: folder.isRoot,
  };
}

async function requireFolder(folderId: string): Promise<{ folders: Folder[]; folder: Folder }> {
  const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) throw new Error(`Folder not found: ${folderId}`);
  return { folders, folder };
}

async function rootId(): Promise<string> {
  const root = await getRootFolderForOrg(LOCAL_ORG_ID);
  if (!root) throw new Error("No root folder");
  return root.id;
}

export function registerFolderTools(
  server: McpServer,
  wrap: <A>(fn: (args: A) => Promise<unknown>) => (args: A) => Promise<any>,
  api: ApiPost
) {
  server.registerTool(
    "list_folders",
    {
      description:
        "List doc-ai folders with their ids, full paths (e.g. \"My Drive/Receipts\") and document counts. " +
        "Folders mirror subdirectories of the watch folder; the root folder is the watch folder itself.",
    },
    wrap(async () => {
      const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
      const docs = await listDocumentsInFoldersForOrg(LOCAL_ORG_ID, folders.map((f) => f.id));
      const counts = new Map<string, number>();
      for (const d of docs) if (d.folderId) counts.set(d.folderId, (counts.get(d.folderId) ?? 0) + 1);
      return folders
        .map((f) => ({ ...summary(folders, f), documentCount: counts.get(f.id) ?? 0 }))
        .sort((a, b) => a.path.localeCompare(b.path));
    })
  );

  server.registerTool(
    "create_folder",
    {
      description:
        "Create a folder (and its directory in the watch folder). parentId defaults to the root folder. " +
        "Fails if a sibling with the same name exists.",
      inputSchema: { name: z.string().min(1), parentId: z.string().optional() },
    },
    wrap(async ({ name, parentId }: { name: string; parentId?: string }) => {
      const parent = parentId ?? (await rootId());
      await requireFolder(parent);
      const { folder } = await api(`${ORG}/folders/create`, { name, parentId: parent });
      return summary(await getFoldersByOrgId(LOCAL_ORG_ID), folder);
    })
  );

  server.registerTool(
    "rename_folder",
    {
      description:
        "Rename a folder; its directory in the watch folder is renamed too and its documents follow. " +
        "The root folder can't be renamed.",
      inputSchema: { folderId: z.string(), name: z.string().min(1) },
    },
    wrap(async ({ folderId, name }: { folderId: string; name: string }) => {
      const { folder } = await requireFolder(folderId);
      if (folder.isRoot) throw new Error("The root folder can't be renamed");
      await api(`${ORG}/folders/${folderId}/rename`, { name });
      const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
      return summary(folders, folders.find((f) => f.id === folderId)!);
    })
  );

  server.registerTool(
    "move_folder",
    {
      description:
        "Move a folder (with its subfolders and documents) under another folder; parentId defaults to the root. " +
        "Its directory moves in the watch folder too.",
      inputSchema: { folderId: z.string(), parentId: z.string().optional() },
    },
    wrap(async ({ folderId, parentId }: { folderId: string; parentId?: string }) => {
      const { folder } = await requireFolder(folderId);
      if (folder.isRoot) throw new Error("The root folder can't be moved");
      const parent = parentId ?? (await rootId());
      await requireFolder(parent);
      await api(`${ORG}/folders/${folderId}/move`, { parentId: parent });
      const folders = await getFoldersByOrgId(LOCAL_ORG_ID);
      return summary(folders, folders.find((f) => f.id === folderId)!);
    })
  );

  server.registerTool(
    "delete_folder",
    {
      description:
        "Delete an empty folder (no documents and no subfolders). Its directory goes to the doc-ai trash. " +
        "Move or delete the contents first; this tool never deletes documents.",
      inputSchema: { folderId: z.string() },
    },
    wrap(async ({ folderId }: { folderId: string }) => {
      const { folders, folder } = await requireFolder(folderId);
      if (folder.isRoot || folder.isSystem) throw new Error(`"${folder.name}" is a system folder and can't be deleted`);
      const subfolders = folders.filter((f) => f.parentId === folderId);
      const docs = await listDocumentsInFoldersForOrg(LOCAL_ORG_ID, [folderId]);
      if (subfolders.length || docs.length) {
        throw new Error(
          `Folder "${folderPath(folders, folderId)}" is not empty ` +
            `(${docs.length} document(s), ${subfolders.length} subfolder(s)); nothing was deleted`
        );
      }
      await api(`${ORG}/folders/${folderId}/delete`, {});
      return { deleted: summary(folders, folder) };
    })
  );

  server.registerTool(
    "move_documents",
    {
      description:
        "Move documents into a folder; their files move to that folder's directory in the watch folder. " +
        "Returns the ids moved and any that failed.",
      inputSchema: { documentIds: z.array(z.string()).min(1).max(500), folderId: z.string() },
    },
    wrap(async ({ documentIds, folderId }: { documentIds: string[]; folderId: string }) => {
      const { folders } = await requireFolder(folderId);
      const moved: string[] = [];
      const failed: { documentId: string; error: string }[] = [];
      for (const documentId of documentIds) {
        try {
          await api(`${ORG}/documents/${documentId}/move`, { folderId });
          moved.push(documentId);
        } catch (error) {
          failed.push({ documentId, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return { folder: summary(folders, folders.find((f) => f.id === folderId)!), moved, failed };
    })
  );
}
