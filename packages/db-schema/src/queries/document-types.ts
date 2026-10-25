/**
 * Org-scoped document type queries.
 *
 * All functions REQUIRE orgId - enforced at compile time.
 * This ensures multi-tenant isolation for document types.
 *
 * @module document-type-queries
 */
import { zdocsDb } from "../db";
import { documentTypesTbl } from "../schemas/document-types";
import { eq, and, isNull, inArray, sql, or } from "drizzle-orm";
import {
  SYSTEM_DOCUMENT_TYPES,
  type DocumentTypeRecord,
  type FieldDefinition,
  type LineItemCollectionSchema,
  type SampleDocument,
} from "@zdocs/types";
import { generateAutoSumFields, mergeAutoSumFields } from "./formula-schema";

// Check if we're running in Edge Runtime
const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

/**
 * Create a new document type for an organization.
 */
export async function createDocumentTypeForOrg(
  orgId: string,
  data: {
    name: string;
    displayName: string;
    description?: string;
    extractionHint?: string;
    isDataset?: boolean;
    isSystem?: boolean;
    headerSchema: FieldDefinition[];
    lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
    icon?: string;
    color?: string;
    sampleDocuments?: SampleDocument[] | null;
  }
): Promise<DocumentTypeRecord> {
  if (isEdgeRuntime) {
    throw new Error("Cannot create document type in Edge Runtime");
  }

  const [newType] = await zdocsDb
    .insert(documentTypesTbl)
    .values({
      orgId,
      entityVersion: 1,
      name: data.name,
      displayName: data.displayName,
      description: data.description || null,
      extractionHint: data.extractionHint || null,
      isDataset: data.isDataset ?? false,
      isSystem: data.isSystem ?? false,
      headerSchema: data.headerSchema,
      lineItemSchemas: data.lineItemSchemas || null,
      icon: data.icon || null,
      color: data.color || null,
      sampleDocuments: data.sampleDocuments || null,
    })
    .returning();

  return newType as DocumentTypeRecord;
}

/**
 * Update a document type for an organization (org-scoped).
 */
export async function updateDocumentTypeForOrg(
  orgId: string,
  id: string,
  data: Partial<{
    displayName: string;
    description: string | null;
    extractionHint: string | null;
    headerSchema: FieldDefinition[];
    lineItemSchemas: Record<string, LineItemCollectionSchema> | null;
    icon: string | null;
    color: string | null;
    isDataset: boolean;
    defaultFolderId: string | null;
  }>
): Promise<DocumentTypeRecord | null> {
  if (isEdgeRuntime) return null;

  const isSchemaChange =
    data.headerSchema !== undefined || data.lineItemSchemas !== undefined;

  const [updated] = await zdocsDb
    .update(documentTypesTbl)
    .set({
      ...data,
      ...(isSchemaChange
        ? { entityVersion: sql`${documentTypesTbl.entityVersion} + 1` }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentTypesTbl.id, id),
        eq(documentTypesTbl.orgId, orgId),
        isNull(documentTypesTbl.deletedAt)
      )
    )
    .returning();

  return (updated as DocumentTypeRecord | undefined) || null;
}

/**
 * Get a document type by name for a specific org.
 *
 * @param name - The document type name (e.g., "INVOICE")
 * @param orgId - The organization ID
 */
export async function getDocumentTypeByNameForOrg(
  name: string,
  orgId: string
): Promise<DocumentTypeRecord | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select()
    .from(documentTypesTbl)
    .where(
      and(
        eq(documentTypesTbl.name, name),
        eq(documentTypesTbl.orgId, orgId),
        isNull(documentTypesTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  return (result[0] as DocumentTypeRecord | undefined) || null;
}

/**
 * Restore a soft-deleted document type by name, updating its schema.
 *
 * The unique constraint on (org_id, name) includes soft-deleted rows, so
 * we must restore instead of re-inserting when a deleted row exists.
 */
export async function restoreSoftDeletedDocumentTypeForOrg(
  orgId: string,
  name: string,
  data: {
    displayName: string;
    description?: string;
    isDataset?: boolean;
    headerSchema: FieldDefinition[];
    lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
    icon?: string | null;
  }
): Promise<DocumentTypeRecord | null> {
  if (isEdgeRuntime) return null;

  const [restored] = await zdocsDb
    .update(documentTypesTbl)
    .set({
      displayName: data.displayName,
      description: data.description ?? null,
      isDataset: data.isDataset ?? false,
      headerSchema: data.headerSchema,
      lineItemSchemas: data.lineItemSchemas ?? null,
      icon: data.icon ?? null,
      deletedAt: null,
      entityVersion: sql`${documentTypesTbl.entityVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentTypesTbl.name, name),
        eq(documentTypesTbl.orgId, orgId),
        sql`${documentTypesTbl.deletedAt} IS NOT NULL`
      )
    )
    .returning();

  return (restored as DocumentTypeRecord | undefined) || null;
}

/**
 * Get all document types for an organization.
 * Auto-seeds if no types exist (lazy initialization for existing orgs).
 *
 * @param orgId - The organization ID
 */
export async function getDocumentTypesForOrg(
  orgId: string,
  options?: { includeDatasets?: boolean }
): Promise<DocumentTypeRecord[]> {
  const includeDatasets = options?.includeDatasets ?? true;
  if (isEdgeRuntime) return [];
  let whereQuery = and(
    eq(documentTypesTbl.orgId, orgId),
    isNull(documentTypesTbl.deletedAt)
  );
  if (includeDatasets === false) {
    whereQuery = and(
      whereQuery,
      or(
        isNull(documentTypesTbl.isDataset),
        eq(documentTypesTbl.isDataset, false)
      )
    );
  }
  const result = await zdocsDb
    .select()
    .from(documentTypesTbl)
    .where(whereQuery)
    .execute();

  // // Lazy seeding: if no types exist for this org, seed them
  // if (result.length === 0) {
  //   console.log(
  //     `[getDocumentTypesForOrg] No types found for org ${orgId}, seeding...`
  //   );
  //   await seedDocumentTypesForOrg(orgId);
  //   // Re-fetch after seeding
  //   const seededResult = await zdocsDb
  //     .select()
  //     .from(documentTypesTbl)
  //     .where(
  //       and(
  //         eq(documentTypesTbl.orgId, orgId),
  //         isNull(documentTypesTbl.deletedAt)
  //       )
  //     )
  //     .execute();
  //   return seededResult as DocumentTypeRecord[];
  // }

  return result as DocumentTypeRecord[];
}

/**
 * Get multiple document types by their names for a specific org.
 * Returns only types that exist and belong to this org.
 *
 * @param names - Array of document type names
 * @param orgId - The organization ID
 */
export async function getDocumentTypesByNamesForOrg(
  names: string[],
  orgId: string
): Promise<DocumentTypeRecord[]> {
  if (isEdgeRuntime || names.length === 0) return [];

  const result = await zdocsDb
    .select()
    .from(documentTypesTbl)
    .where(
      and(
        inArray(documentTypesTbl.name, names),
        eq(documentTypesTbl.orgId, orgId),
        isNull(documentTypesTbl.deletedAt)
      )
    )
    .execute();

  return result as DocumentTypeRecord[];
}

export async function getDocumentTypeById(
  id: string
): Promise<DocumentTypeRecord[]> {
  const result = await zdocsDb
    .select()
    .from(documentTypesTbl)
    .where(and(eq(documentTypesTbl.id, id), isNull(documentTypesTbl.deletedAt)))
    .execute();

  return result as DocumentTypeRecord[];
}

/**
 * Seed document types for an organization from system templates.
 * Call this when creating a new organization.
 * upset types
 * NOW UPDATES EXISTING SCHEMAS - use to refresh schemas after changes.
 *
 * @param orgId - The organization ID
 * @param schemaFilter - Optional array of schema names to import
 * @param folderMap - Optional map of default folder names to folder IDs
 */
export async function seedDocumentTypesForOrg(
  orgId: string,
  schemaFilter?: string[],
  folderMap?: Record<string, string>
): Promise<void> {
  if (isEdgeRuntime) {
    throw new Error("Cannot seed document types in Edge Runtime");
  }

  let typesToProcess = SYSTEM_DOCUMENT_TYPES;
  if (schemaFilter && schemaFilter.length > 0) {
    typesToProcess = SYSTEM_DOCUMENT_TYPES.filter((type) =>
      schemaFilter.includes(type.name)
    );
  }

  const typesToUpsert = typesToProcess.map((type) => {
    // Generate auto sum fields for numeric line item columns
    const autoSumFields = generateAutoSumFields(type.lineItemSchemas);

    // Merge auto sum fields into header schema (preserves existing fields)
    const enrichedHeaderSchema = mergeAutoSumFields(
      type.headerSchema,
      autoSumFields
    );

    return {
      orgId,
      entityVersion: 1,
      name: type.name,
      displayName: type.displayName,
      description: type.description,
      templateName: type.name, // Track origin for future bulk updates
      headerSchema: enrichedHeaderSchema,
      lineItemSchemas: type.lineItemSchemas || null,
      isSystem: true,
      defaultFolderId: folderMap?.[type.defaultFolderName] || null,
      icon: type.icon,
      color: type.color,
    };
  });

  // Use upsert to update existing types or create new ones
  await zdocsDb
    .insert(documentTypesTbl)
    .values(typesToUpsert)
    .onConflictDoUpdate({
      target: [documentTypesTbl.orgId, documentTypesTbl.name],
      set: {
        displayName: sql`EXCLUDED.display_name`,
        description: sql`EXCLUDED.description`,
        headerSchema: sql`EXCLUDED.header_schema`,
        lineItemSchemas: sql`EXCLUDED.line_item_schemas`,
        icon: sql`EXCLUDED.icon`,
        color: sql`EXCLUDED.color`,
        entityVersion: sql`${documentTypesTbl.entityVersion} + 1`,
        updatedAt: new Date(),
      },
    });

  console.log(
    `[seedDocumentTypesForOrg] Upserted ${typesToUpsert.length} types for org ${orgId}`
  );
}

/**
 * Ensures document types exist for an organization.
 * Safe to call on every org access - uses lazy seeding internally.
 *
 * @param orgId - The organization ID
 */
export async function ensureDocumentTypesForOrg(orgId: string): Promise<void> {
  if (isEdgeRuntime) return;

  const existingCount = await zdocsDb
    .select({ name: documentTypesTbl.name })
    .from(documentTypesTbl)
    .where(
      and(eq(documentTypesTbl.orgId, orgId), isNull(documentTypesTbl.deletedAt))
    );

  const expectedCount = SYSTEM_DOCUMENT_TYPES.length;

  if (existingCount.length < expectedCount) {
    console.log(
      `[ensureDocumentTypesForOrg] Found ${existingCount.length}/${expectedCount} types for org ${orgId}, seeding...`
    );
    await seedDocumentTypesForOrg(orgId);
  }
}

/**
 * Build AI classification prompt listing available document types
 *
 * @param types - Array of document types
 */
export function buildClassificationTypeList(
  types: DocumentTypeRecord[]
): string {
  return types
    .map((t) => `- ${t.name}: ${t.description || t.displayName}`)
    .join("\n");
}

/**
 * Soft delete a document type for an organization.
 * Sets deletedAt timestamp instead of removing the record.
 *
 * @param orgId - The organization ID
 * @param id - The document type ID
 * @returns true if deleted, false if not found
 */
export async function deleteDocumentTypeForOrg(
  orgId: string,
  id: string
): Promise<boolean> {
  if (isEdgeRuntime) return false;

  const result = await zdocsDb
    .update(documentTypesTbl)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentTypesTbl.id, id),
        eq(documentTypesTbl.orgId, orgId),
        isNull(documentTypesTbl.deletedAt)
      )
    )
    .returning({ id: documentTypesTbl.id });

  return result.length > 0;
}

/**
 * Hard delete all document types with the same name for an organization.
 *
 * Needed when recreating a type under a strict unique index on (org_id, name),
 * because soft-deleted rows still keep their original name.
 *
 * @param orgId - The organization ID
 * @param name - The document type name
 * @returns number of deleted rows
 */
export async function hardDeleteDocumentTypesByNameForOrg(
  orgId: string,
  name: string
): Promise<number> {
  if (isEdgeRuntime) return 0;

  const result = await zdocsDb
    .delete(documentTypesTbl)
    .where(
      and(eq(documentTypesTbl.orgId, orgId), eq(documentTypesTbl.name, name))
    )
    .returning({ id: documentTypesTbl.id });

  return result.length;
}

/**
 * Restore a soft-deleted document type by name, or create a new one if it doesn't exist.
 * This handles the case where a type was deleted and needs to be re-added.
 *
 * @param orgId - The organization ID
 * @param data - The document type data
 * @returns The restored or created document type
 */
export async function restoreOrCreateDocumentTypeForOrg(
  orgId: string,
  data: {
    name: string;
    displayName: string;
    description?: string;
    isDataset?: boolean;
    isSystem?: boolean;
    headerSchema: FieldDefinition[];
    lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
    icon?: string;
    color?: string;
  }
): Promise<DocumentTypeRecord> {
  if (isEdgeRuntime) {
    throw new Error("Cannot restore/create document type in Edge Runtime");
  }

  // First, check if a deleted type with this name exists
  const existingDeleted = await zdocsDb
    .select()
    .from(documentTypesTbl)
    .where(
      and(
        eq(documentTypesTbl.orgId, orgId),
        eq(documentTypesTbl.name, data.name),
        sql`${documentTypesTbl.deletedAt} IS NOT NULL`
      )
    )
    .limit(1);

  if (existingDeleted.length > 0) {
    // Restore the deleted type with updated schema
    const [restored] = await zdocsDb
      .update(documentTypesTbl)
      .set({
        displayName: data.displayName,
        description: data.description || null,
        isDataset: data.isDataset ?? false,
        isSystem: data.isSystem ?? false,
        headerSchema: data.headerSchema,
        lineItemSchemas: data.lineItemSchemas || null,
        icon: data.icon || null,
        color: data.color || null,
        entityVersion: 1, // Reset version on restore with new schema
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(documentTypesTbl.id, existingDeleted[0].id))
      .returning();

    return restored as DocumentTypeRecord;
  }

  // Create a new type
  const [newType] = await zdocsDb
    .insert(documentTypesTbl)
    .values({
      orgId,
      entityVersion: 1,
      name: data.name,
      displayName: data.displayName,
      description: data.description || null,
      isDataset: data.isDataset ?? false,
      isSystem: data.isSystem ?? false,
      headerSchema: data.headerSchema,
      lineItemSchemas: data.lineItemSchemas || null,
      icon: data.icon || null,
      color: data.color || null,
    })
    .returning();

  return newType as DocumentTypeRecord;
}
