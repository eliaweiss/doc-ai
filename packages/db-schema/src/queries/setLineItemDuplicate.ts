import { and, eq, isNull } from "drizzle-orm";
import { zdocsDb } from "../db";
import { documentDataTbl, documentTbl } from "../schemas/documents";
import { searchIndexTbl } from "../schemas/search";

const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

export interface SetLineItemDuplicateResult {
  ok: boolean;
  error?: string;
}

/**
 * Mark or unmark a single line item as a duplicate.
 *
 * Updates two places:
 *  - `document_data.lineItems[collectionKey][index].isDuplicate`
 *  - `search_index.is_duplicate` for the matching entityId (org-scoped)
 *
 * The entityId format is `{documentId}_{collectionKey}_{index}`. Headers cannot
 * be marked as duplicates (entityId would equal documentId).
 */
export async function setLineItemDuplicate(
  orgId: string,
  documentId: string,
  entityId: string,
  isDuplicate: boolean
): Promise<SetLineItemDuplicateResult> {
  if (isEdgeRuntime) return { ok: false, error: "Edge runtime not supported" };

  const prefix = `${documentId}_`;
  if (!entityId.startsWith(prefix)) {
    return { ok: false, error: "Invalid entityId for documentId" };
  }
  const suffix = entityId.slice(prefix.length);
  const lastUnderscore = suffix.lastIndexOf("_");
  if (lastUnderscore <= 0) {
    return { ok: false, error: "Invalid entityId format" };
  }
  const collectionKey = suffix.slice(0, lastUnderscore);
  const index = parseInt(suffix.slice(lastUnderscore + 1), 10);
  if (isNaN(index)) {
    return { ok: false, error: "Invalid line item index" };
  }

  const dataResult = await zdocsDb
    .select({
      id: documentDataTbl.id,
      lineItems: documentDataTbl.lineItems,
    })
    .from(documentDataTbl)
    .where(
      and(
        eq(documentDataTbl.documentId, documentId),
        eq(documentDataTbl.orgId, orgId),
        isNull(documentDataTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  const docData = dataResult[0];
  if (!docData) {
    return { ok: false, error: "Document data not found" };
  }

  const lineItems = (docData.lineItems ?? {}) as Record<
    string,
    Record<string, unknown>[]
  >;
  const collection = lineItems[collectionKey];
  if (!Array.isArray(collection) || !collection[index]) {
    return { ok: false, error: "Line item not found" };
  }

  const updatedItem = { ...collection[index], isDuplicate };
  const updatedCollection = [...collection];
  updatedCollection[index] = updatedItem;
  const updatedLineItems = {
    ...lineItems,
    [collectionKey]: updatedCollection,
  };

  await zdocsDb
    .update(documentDataTbl)
    .set({
      lineItems: updatedLineItems,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentDataTbl.documentId, documentId),
        eq(documentDataTbl.orgId, orgId)
      )
    );

  await zdocsDb
    .update(searchIndexTbl)
    .set({
      isDuplicate,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(searchIndexTbl.entityId, entityId),
        eq(searchIndexTbl.orgId, orgId)
      )
    );

  await zdocsDb
    .update(documentTbl)
    .set({ updatedAt: new Date() })
    .where(and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId)));

  return { ok: true };
}
