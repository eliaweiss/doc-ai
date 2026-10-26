/**
 * doc-ai: local single-user helpers (no auth, one fixed organization).
 *
 * zdocs' query layer is org-scoped everywhere (`*ForOrg(orgId, ...)`);
 * doc-ai keeps that and uses one fixed org row instead of refactoring.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { zdocsDb } from "../db";
import { usersTbl } from "../schemas/auth";
import { organizationsTbl } from "../schemas/organizations";
import { documentTbl } from "../schemas/documents";
import { ensureDocumentTypesForOrg } from "./document-types";
import { createFolder, getRootFolderForOrg } from "./folders";
import { seedDefaultQuickAccess } from "./quick-access";
import type { Document, Folder } from "@zdocs/types";

export const LOCAL_ORG_ID = "local";
export const LOCAL_USER_ID = "local-user";

/** The machine's IANA timezone, e.g. "Europe/Berlin" */
function getMachineTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/**
 * Create the local user, organization, root folder and system document types
 * if they don't exist yet. Safe to call on every start.
 */
export async function ensureLocalOrg(): Promise<{ orgId: string; rootFolder: Folder }> {
  await zdocsDb
    .insert(usersTbl)
    .values({ id: LOCAL_USER_ID, email: "local@doc-ai.local", name: "Local user" })
    .onConflictDoNothing();

  const createdOrg = await zdocsDb
    .insert(organizationsTbl)
    .values({
      id: LOCAL_ORG_ID,
      name: "doc-ai",
      ownerUserId: LOCAL_USER_ID,
      timezone: getMachineTimezone(),
    })
    .onConflictDoNothing()
    .returning({ id: organizationsTbl.id });

  // Orgs created before the default was the machine's timezone: switch them
  // while the timezone is still the old "UTC" default and the org was never edited
  if (createdOrg.length === 0) {
    await zdocsDb
      .update(organizationsTbl)
      .set({ timezone: getMachineTimezone() })
      .where(
        and(
          eq(organizationsTbl.id, LOCAL_ORG_ID),
          eq(organizationsTbl.timezone, "UTC"),
          sql`${organizationsTbl.updatedAt} = ${organizationsTbl.createdAt}`
        )
      );
  }

  await ensureDocumentTypesForOrg(LOCAL_ORG_ID);

  let rootFolder = await getRootFolderForOrg(LOCAL_ORG_ID);
  if (!rootFolder) {
    rootFolder = await createFolder({
      orgId: LOCAL_ORG_ID,
      name: "Documents",
      parentId: null,
      isRoot: true,
      isSystem: true,
    });
  }

  // Same as zdocs' createOrganization: default sidebar shortcuts for a new org
  if (createdOrg.length > 0) {
    await seedDefaultQuickAccess(LOCAL_ORG_ID, LOCAL_USER_ID);
  }

  return { orgId: LOCAL_ORG_ID, rootFolder };
}

/**
 * Find a live document by content hash (dedupe for the folder watcher).
 */
export async function findDocumentByContentHashForOrg(
  orgId: string,
  contentHash: string
): Promise<Document | null> {
  const rows = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        eq(documentTbl.contentHash, contentHash),
        isNull(documentTbl.deletedAt)
      )
    )
    .limit(1);
  return (rows[0] as Document | undefined) ?? null;
}

/**
 * All live documents with this content hash (the same file can sit in several folders).
 */
export async function findDocumentsByContentHashForOrg(
  orgId: string,
  contentHash: string
): Promise<Document[]> {
  const rows = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        eq(documentTbl.contentHash, contentHash),
        isNull(documentTbl.deletedAt)
      )
    );
  return rows as Document[];
}

/**
 * Find a live document by its path in the watch folder.
 */
export async function findDocumentByS3KeyForOrg(
  orgId: string,
  s3Key: string
): Promise<Document | null> {
  const rows = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        eq(documentTbl.s3Key, s3Key),
        isNull(documentTbl.deletedAt)
      )
    )
    .limit(1);
  return (rows[0] as Document | undefined) ?? null;
}

/**
 * Update a document's storage fields: new path after a rename/move inside the
 * watch folder, or a derived file in the cache dir (spreadsheet converted to CSV).
 * zdocs' updateDocumentForOrg doesn't cover s3Bucket / metadata.
 */
export async function updateDocumentStorageForOrg(
  orgId: string,
  documentId: string,
  data: Partial<{
    s3Key: string;
    s3Bucket: string;
    fileName: string;
    fileExtension: string;
    contentType: string;
    metadata: Record<string, unknown> | null;
  }>
): Promise<void> {
  await zdocsDb
    .update(documentTbl)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(documentTbl.orgId, orgId), eq(documentTbl.id, documentId)));
}

/**
 * Live documents in any of these folders (folder ↔ directory sync).
 */
export async function listDocumentsInFoldersForOrg(
  orgId: string,
  folderIds: string[]
): Promise<Document[]> {
  if (folderIds.length === 0) return [];
  const rows = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        inArray(documentTbl.folderId, folderIds),
        isNull(documentTbl.deletedAt)
      )
    );
  return rows as Document[];
}

/**
 * Live documents that came from a file in the watch folder, with that file's
 * path (metadata.sourcePath). Pass a path to get only the documents at it.
 */
export async function listDocumentSourcePathsForOrg(
  orgId: string,
  sourcePath?: string
): Promise<{ id: string; sourcePath: string }[]> {
  const pathExpr = sql<string>`${documentTbl.metadata}->>'sourcePath'`;
  const rows = await zdocsDb
    .select({ id: documentTbl.id, sourcePath: pathExpr })
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt),
        sourcePath === undefined ? sql`${pathExpr} is not null` : sql`${pathExpr} = ${sourcePath}`
      )
    );
  return rows;
}
