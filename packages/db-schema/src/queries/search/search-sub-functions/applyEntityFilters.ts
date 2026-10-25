import { searchIndexTbl } from "../../../schemas/search";
import { eq, inArray, SQL } from "drizzle-orm";
import type { SearchByEntityMultiQueryOptions } from "@zdocs/types";

/**
 * Apply entity metadata filters (exact matching) to search conditions
 * These filters operate on entity metadata fields in the search_index table
 */
export function applyEntityFilters(
  filters: SearchByEntityMultiQueryOptions["filters"],
  conditions: SQL[]
): void {
  if (!filters?.entity) {
    return;
  }

  // Filter by entityId
  if (filters.entity.entityId) {
    const entityIds = Array.isArray(filters.entity.entityId)
      ? filters.entity.entityId
      : [filters.entity.entityId];
    if (entityIds.length > 0) {
      conditions.push(inArray(searchIndexTbl.entityId, entityIds));
    }
  }

  // Filter by documentId
  if (filters.entity.documentId) {
    const documentIds = Array.isArray(filters.entity.documentId)
      ? filters.entity.documentId
      : [filters.entity.documentId];
    if (documentIds.length > 0) {
      conditions.push(inArray(searchIndexTbl.documentId, documentIds));
    }
  }

  // Filter by entityType
  if (filters.entity.entityType) {
    const entityTypes = Array.isArray(filters.entity.entityType)
      ? filters.entity.entityType
      : [filters.entity.entityType];
    if (entityTypes.length > 0) {
      conditions.push(inArray(searchIndexTbl.entityType, entityTypes));
    }
  }

  // Filter by docType
  if (filters.entity.docType) {
    const docTypes = Array.isArray(filters.entity.docType)
      ? filters.entity.docType
      : [filters.entity.docType];
    if (docTypes.length > 0) {
      conditions.push(inArray(searchIndexTbl.docType, docTypes));
    }
  }

  // Filter by schemaType
  if (filters.entity.schemaType) {
    const schemaTypes = Array.isArray(filters.entity.schemaType)
      ? filters.entity.schemaType
      : [filters.entity.schemaType];
    if (schemaTypes.length > 0) {
      conditions.push(inArray(searchIndexTbl.schemaType, schemaTypes));
    }
  }

  // Filter by collectionKey
  if (filters.entity.collectionKey) {
    const collectionKeys = Array.isArray(filters.entity.collectionKey)
      ? filters.entity.collectionKey
      : [filters.entity.collectionKey];
    if (collectionKeys.length > 0) {
      conditions.push(inArray(searchIndexTbl.collectionKey, collectionKeys));
    }
  }

  // Filter by isDataset
  if (filters.entity.isDataset !== undefined) {
    conditions.push(eq(searchIndexTbl.isDataset, filters.entity.isDataset));
  }
}
