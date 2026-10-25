/**
 * Build schemaType from docType and collectionKey
 * @param docType - Document type name (e.g., "INVOICE")
 * @param collectionKey - Collection name (e.g., "items"), or null for headers
 * @returns schemaType string (e.g., "INVOICE_items" or "INVOICE_header")
 */
export function buildSchemaType(docType: string, collectionKey: string | null): string {
  return collectionKey ? `${docType}_${collectionKey}` : `${docType}_header`;
}

/**
 * Parse schemaType back into its components
 * @param schemaType - schemaType string
 * @returns object with docType and collectionKey
 */
export function parseSchemaType(schemaType: string): { docType: string; collectionKey: string | null } {
  // Handle multi-word docTypes like "BANK_STATEMENT"
  // schemaType format: {docType}_{collectionKey}
  const lastIdx = schemaType.lastIndexOf('_');
  if (lastIdx === -1) {
    // Fallback for safety
    return { docType: schemaType, collectionKey: null };
  }

  const suffix = schemaType.slice(lastIdx + 1);
  const docType = schemaType.slice(0, lastIdx);

  if (suffix === 'header') {
    return { docType, collectionKey: null };
  }

  return { docType, collectionKey: suffix };
}

/**
 * Build entityId for headers or line items
 * @param documentId - Parent document ID
 * @param collectionKey - Collection name or null for headers
 * @param index - Index within collection (required if collectionKey is not null)
 * @returns entityId string
 */
export function buildEntityId(
  documentId: string,
  collectionKey: string | null,
  index?: number
): string {
  if (collectionKey === null || index === undefined) {
    return documentId; // Header
  }
  return `${documentId}_${collectionKey}_${index}`;
}

