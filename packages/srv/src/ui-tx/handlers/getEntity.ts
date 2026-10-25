import {
  getDocumentForOrg,
  getDocumentDataForOrg,
  getDocumentTypeByNameForOrg,
} from "@zdocs/db-schema";
import type { GetEntityResponse, EntityObj } from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

interface GetEntityParams {
  orgId: string; // Required but validated at route level
  entityId: string;
}

/**
 * TODO: this code is not correct - it doesn't handle line items correctly - should be fetch from searchIndex
 * Get full entity data with schema
 */
export async function handleGetEntity(
  context: UiTxContext,
  params: GetEntityParams
): Promise<GetEntityResponse> {
  const { orgId } = context;
  const { entityId } = params;

  if (!entityId) {
    throw new Error("entityId is required");
  }

  // Parse entityId to get documentId and determine if it's header or line item
  // Format: documentId (header) or documentId_collectionKey_index (line item)
  const parts = entityId.split("_");
  const documentId = parts[0]; // First part is always documentId

  // Check if it's a line item (has more than one part)
  const isLineItem = parts.length > 1;
  const collectionKey = isLineItem ? parts[1] : null;
  const index = isLineItem ? parseInt(parts[2], 10) : undefined;

  // Get document
  const document = await getDocumentForOrg(orgId, documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  if (!document.docType) {
    throw new Error("Document type not set");
  }

  // Get document data
  const documentData = await getDocumentDataForOrg(orgId, documentId);
  if (!documentData) {
    throw new Error("Document data not found");
  }

  // Get document type schema
  const docTypeRecord = await getDocumentTypeByNameForOrg(
    document.docType,
    orgId
  );
  if (!docTypeRecord) {
    throw new Error("Document type schema not found");
  }

  // Determine entity type
  const entityType = isLineItem ? "LINE_ITEM" : "HEADER";

  // Extract entity data
  let entityData: Record<string, unknown>;
  let schema = docTypeRecord.headerSchema;

  if (isLineItem && collectionKey && index !== undefined) {
    // Extract line item from lineItems data
    const lineItems = documentData.lineItems as Record<
      string,
      Record<string, unknown>[]
    > | null;
    if (!lineItems || !lineItems[collectionKey]) {
      throw new Error("Line item collection not found");
    }

    const collection = lineItems[collectionKey];
    if (!Array.isArray(collection) || !collection[index]) {
      throw new Error("Line item not found");
    }

    entityData = collection[index];

    // Get line item schema
    const collectionSchema = docTypeRecord.lineItemSchemas?.[collectionKey];
    if (!collectionSchema) {
      throw new Error(
        `Line item schema not found for collection: ${collectionKey}`
      );
    }
    schema = collectionSchema.fields;
  } else {
    // Header entity
    entityData = (documentData.headerData as Record<string, unknown>) || {};
  }

  // Build EntityObj
  const ref: EntityObj = {
    isDataset: document.isDataset,
    entityId,
    documentId,
    entityType,
    docType: document.docType,
    schemaType: isLineItem
      ? `${document.docType}_${collectionKey}`
      : `${document.docType}_header`,
    collectionKey,
    index,
    date: document.documentDate || "",
  };

  return {
    ref,
    data: entityData,
    schema,
    document: {
      id: document.id,
      folderId: document.folderId || undefined,
      currency: document.currency || undefined,
      documentDate: document.documentDate || undefined,
      description: document.description || undefined,
    },
  };
}
