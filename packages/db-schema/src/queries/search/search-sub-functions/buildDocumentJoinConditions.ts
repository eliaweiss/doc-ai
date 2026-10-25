import { searchIndexTbl } from "../../../schemas/search";
import { documentTbl } from "../../../schemas/documents";
import { eq, and, gte, lte, inArray, SQL } from "drizzle-orm";
import { getDateStr } from "@zdocs/util";
import type { SearchByEntityMultiQueryOptions } from "@zdocs/types";

/**
 * Build document table join conditions including date and folder filters
 */
export function buildDocumentJoinConditions(
  filters: SearchByEntityMultiQueryOptions["filters"]
): SQL {
  const documentConditions: SQL[] = [
    eq(searchIndexTbl.documentId, documentTbl.id),
  ];

  // Date filter (on search index, from preview filters)
  if (filters?.preview?.date?.gte) {
    documentConditions.push(
      gte(searchIndexTbl.date, getDateStr(filters.preview.date.gte)!)
    );
  }
  if (filters?.preview?.date?.lte) {
    documentConditions.push(
      lte(searchIndexTbl.date, getDateStr(filters.preview.date.lte)!)
    );
  }

  // FolderId filter (on document table, from entity filters)
  if (filters?.entity?.folderId) {
    const folderIds = Array.isArray(filters.entity.folderId)
      ? filters.entity.folderId
      : [filters.entity.folderId];
    if (folderIds.length > 0) {
      documentConditions.push(inArray(documentTbl.folderId, folderIds));
    }
  }

  return and(...documentConditions)!;
}
