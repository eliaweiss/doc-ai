import { zdocsDb } from "../../db";
import { searchIndexTbl } from "../../schemas/search";
import { documentTbl } from "../../schemas/documents";
import { documentTypesTbl } from "../../schemas/document-types";
import { eq, and, isNull, desc } from "drizzle-orm";
import type {
  SearchableEntityOption,
  EntityType,
  FieldDefinition,
} from "@zdocs/types";
import { isEdgeRuntime } from "./utils";

/**
 * Get all searchable entities for an organization.
 * Only returns entities that have at least one indexed entry in search_index.
 */
export async function getSearchableEntitiesForOrg(
  orgId: string
): Promise<SearchableEntityOption[]> {
  if (isEdgeRuntime) return [];

  // Get distinct (docType, entityType, collectionKey, schemaType) combinations that have indexed content
  const indexedEntities = await zdocsDb
    .selectDistinct({
      docType: searchIndexTbl.docType,
      entityType: searchIndexTbl.entityType,
      collectionKey: searchIndexTbl.collectionKey,
      schemaType: searchIndexTbl.schemaType,
    })
    .from(searchIndexTbl)
    .innerJoin(documentTbl, eq(searchIndexTbl.documentId, documentTbl.id))
    .where(eq(searchIndexTbl.orgId, orgId))
    .orderBy(desc(searchIndexTbl.schemaType))
    .execute();

  // If nothing is indexed, return empty
  if (indexedEntities.length === 0) {
    return [];
  }

  // Fetch all document types for the org to get schemas
  const documentTypes = await zdocsDb
    .select({
      id: documentTypesTbl.id,
      name: documentTypesTbl.name,
      displayName: documentTypesTbl.displayName,
      headerSchema: documentTypesTbl.headerSchema,
      lineItemSchemas: documentTypesTbl.lineItemSchemas,
      isDataset: documentTypesTbl.isDataset,
    })
    .from(documentTypesTbl)
    .where(
      and(eq(documentTypesTbl.orgId, orgId), isNull(documentTypesTbl.deletedAt))
    )
    .execute();

  const typeNameMap = new Map(documentTypes.map((t) => [t.name, t]));

  const entities: SearchableEntityOption[] = [];

  for (const row of indexedEntities) {
    if (!row.schemaType || !row.docType) continue;

    const docType = typeNameMap.get(row.docType);
    if (!docType) continue;

    const isHeader = row.entityType === "HEADER";

    // Datasets do not have a header searchable entity
    if (isHeader && docType.isDataset) continue;

    const collectionDisplayName =
      (docType.lineItemSchemas as any)?.[row.collectionKey || ""]
        ?.displayName ||
      row.collectionKey ||
      "Items";

    const displayName = isHeader
      ? docType.displayName || docType.name
      : docType.isDataset
        ? docType.displayName || collectionDisplayName
        : collectionDisplayName;

    let schema: FieldDefinition[] = [];
    if (isHeader) {
      schema = docType.headerSchema as FieldDefinition[];
    } else if (row.collectionKey) {
      schema =
        (docType.lineItemSchemas as any)?.[row.collectionKey]?.fields || [];
    }

    entities.push({
      schemaType: row.schemaType,
      docType: row.docType,
      entityType: row.entityType as EntityType,
      collectionKey: row.collectionKey,
      displayName,
      schema,
      isDataset: docType.isDataset ?? false,
    });
  }

  return entities;
}
