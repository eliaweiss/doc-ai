/**
 * Extract a specific line item from lineItems data based on entityId
 * entityId format: documentId_collectionKey_N
 */
export function extractLineItemFromEntityId(
  entityId: string,
  documentId: string,
  collectionKey: string | null,
  lineItems: Record<string, Record<string, unknown>[]> | null
): Record<string, unknown> | null {
  if (!lineItems || !collectionKey) return null;

  // Remove documentId prefix
  const suffix = entityId.replace(`${documentId}_`, "");

  // Format: collectionKey_N
  const indexStr = suffix.replace(`${collectionKey}_`, "");
  const index = parseInt(indexStr, 10);
  if (isNaN(index)) return null;

  const collection = lineItems[collectionKey];
  if (!collection || !Array.isArray(collection)) return null;

  return collection[index] ?? null;
}

