import { zdocsDb } from "../db";
import { foldersTbl } from "../schemas/folders";
import { eq, and, isNull, asc } from "drizzle-orm";
import type { Folder, FolderType } from "@zdocs/types";
import { SYSTEM_DOCUMENT_TYPES } from "@zdocs/types";

// Check if we're running in Edge Runtime
const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

/**
 * Get all folders for an organization
 */
export async function getFoldersByOrgId(orgId: string): Promise<Folder[]> {
  if (isEdgeRuntime) return [];

  const result = await zdocsDb
    .select()
    .from(foldersTbl)
    .where(and(eq(foldersTbl.orgId, orgId), isNull(foldersTbl.deletedAt)))
    .orderBy(asc(foldersTbl.name))
    .execute();

  return result as Folder[];
}

/**
 * Get a folder by ID
 */
export async function getFolderById(id: string): Promise<Folder | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select()
    .from(foldersTbl)
    .where(and(eq(foldersTbl.id, id), isNull(foldersTbl.deletedAt)))
    .limit(1)
    .execute();

  return (result[0] as Folder | undefined) || null;
}

/**
 * Get a folder by ID with org-scope (multi-tenant safe)
 */
export async function getFolderForOrg(
  orgId: string,
  folderId: string
): Promise<Folder | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select()
    .from(foldersTbl)
    .where(
      and(
        eq(foldersTbl.id, folderId),
        eq(foldersTbl.orgId, orgId),
        isNull(foldersTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  return (result[0] as Folder | undefined) || null;
}

/**
 * Get the root folder ("My Drive") for an organization
 */
export async function getRootFolderForOrg(
  orgId: string
): Promise<Folder | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select()
    .from(foldersTbl)
    .where(
      and(
        eq(foldersTbl.orgId, orgId),
        isNull(foldersTbl.parentId),
        isNull(foldersTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  return (result[0] as Folder | undefined) || null;
}

/**
 * Build the folder path (breadcrumbs) from a folder up to the root
 * Returns array ordered from root to the specified folder
 */
export async function getFolderPathForOrg(
  orgId: string,
  folderId: string
): Promise<Folder[]> {
  if (isEdgeRuntime) return [];

  const path: Folder[] = [];
  let currentFolderId: string | null = folderId;

  while (currentFolderId) {
    const folder = await getFolderForOrg(orgId, currentFolderId);
    if (!folder) break;

    path.unshift(folder);
    currentFolderId = folder.parentId;
  }

  return path;
}

/**
 * Create a new folder
 */
export async function createFolder(params: {
  orgId: string;
  name: string;
  parentId: string | null;
  type?: FolderType;
  isSystem?: boolean;
  isRoot?: boolean;
  description?: string | null;
  color?: string | null;
}): Promise<Folder> {
  if (isEdgeRuntime) throw new Error("Cannot create folder in Edge Runtime");

  const [folder] = await zdocsDb
    .insert(foldersTbl)
    .values({
      orgId: params.orgId,
      name: params.name,
      parentId: params.parentId,
      type: params.type || "GENERAL",
      isSystem: params.isSystem || false,
      isRoot: params.isRoot || false,
      description: params.description || null,
      color: params.color || null,
    })
    .returning();

  return folder as Folder;
}

/**
 * Rename a folder
 */
export async function renameFolder(
  folderId: string,
  orgId: string,
  name: string
): Promise<Folder | null> {
  if (isEdgeRuntime) return null;

  const [folder] = await zdocsDb
    .update(foldersTbl)
    .set({ name, updatedAt: new Date() })
    .where(
      and(
        eq(foldersTbl.id, folderId),
        eq(foldersTbl.orgId, orgId),
        isNull(foldersTbl.deletedAt)
      )
    )
    .returning();

  return (folder as Folder | undefined) || null;
}

/**
 * Move a folder to a new parent
 */
export async function moveFolder(
  folderId: string,
  orgId: string,
  newParentId: string | null
): Promise<Folder | null> {
  if (isEdgeRuntime) return null;

  const [folder] = await zdocsDb
    .update(foldersTbl)
    .set({ parentId: newParentId, updatedAt: new Date() })
    .where(
      and(
        eq(foldersTbl.id, folderId),
        eq(foldersTbl.orgId, orgId),
        isNull(foldersTbl.deletedAt)
      )
    )
    .returning();

  return (folder as Folder | undefined) || null;
}

/**
 * Soft delete a folder
 */
export async function deleteFolder(
  folderId: string,
  orgId: string
): Promise<boolean> {
  if (isEdgeRuntime) return false;

  // Don't allow deleting system folders
  const folder = await getFolderById(folderId);
  if (!folder || folder.isSystem) {
    return false;
  }

  const result = await zdocsDb
    .update(foldersTbl)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(foldersTbl.id, folderId),
        eq(foldersTbl.orgId, orgId),
        isNull(foldersTbl.deletedAt)
      )
    )
    .returning({ id: foldersTbl.id });

  return result.length > 0;
}

/**
 * Create default folder structure for a new organization
 */
export async function createDefaultFolders(
  orgId: string,
  selectedSchemas?: string[]
): Promise<{ folders: Folder[]; folderMap: Record<string, string> }> {
  if (isEdgeRuntime) return { folders: [], folderMap: {} };

  // Create "My Drive" root folder
  const rootFolder = await createFolder({
    orgId,
    name: "My Drive",
    parentId: null,
    type: "GENERAL",
    isSystem: true,
    isRoot: true,
  });

  const createdFolders: Folder[] = [rootFolder];
  const folderMap: Record<string, string> = {};

  // Filter schemas to get unique folder names
  const schemasToCreate = selectedSchemas
    ? SYSTEM_DOCUMENT_TYPES.filter((t) => selectedSchemas.includes(t.name))
    : SYSTEM_DOCUMENT_TYPES;

  // Use a Map to track unique folder names and avoid duplicate creation
  const uniqueFolders = new Map<string, { name: string; type: string }>();

  for (const schema of schemasToCreate) {
    if (!uniqueFolders.has(schema.defaultFolderName)) {
      let type: FolderType = "GENERAL";

      uniqueFolders.set(schema.defaultFolderName, {
        name: schema.defaultFolderName,
        type,
      });
    }
  }

  for (const folderDef of uniqueFolders.values()) {
    const folder = await createFolder({
      orgId,
      name: folderDef.name,
      parentId: rootFolder.id,
      type: folderDef.type as FolderType,
      isSystem: true,
      isRoot: false,
    });
    createdFolders.push(folder);
    folderMap[folderDef.name] = folder.id;
  }

  return { folders: createdFolders, folderMap };
}
