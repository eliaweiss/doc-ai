import type { Document, DocumentData, DocumentTypeRecord } from "@zdocs/types";
import { ensureItemBaseData } from "@zdocs/db-schema";

/**
 * Enriches line items in documentData with base data and metadata.
 * Mutates the documentData object in place.
 */
export function enrichLineItemsWithMetadata(
  documentData: DocumentData | null | undefined,
  document: Document,
  documentType: DocumentTypeRecord | null | undefined
): void {
  if (
    !documentData?.lineItems ||
    Object.keys(documentData.lineItems).length === 0
  ) {
    return;
  }

  if (!documentType?.lineItemSchemas) {
    return;
  }

  for (const [collectionKey, lineItemCollection] of Object.entries(
    documentData.lineItems
  )) {
    const collectionSchema = documentType.lineItemSchemas[collectionKey];
    if (!collectionSchema || !lineItemCollection) {
      continue;
    }

    for (const lineItem of lineItemCollection) {
      const { date, currency, amount, description } = ensureItemBaseData(
        lineItem,
        collectionSchema,
        documentData,
        document
      );

      lineItem.date = date;
      lineItem.currency = currency;
      lineItem.amount = amount;
      lineItem.description = description;

      lineItem.metadata = {
        date,
        currency,
        amount,
        description,
        docType: document.docType,
        collectionKey,
        entityType: "LINE_ITEM",
        entityId: lineItem.id,
        documentId: document.id,
      };
    }
  }
}
