/**
 * Update entity fields handler
 *
 * Updates fields in a document header or line item.
 * Validates field names against schema and updates document data.
 */

import {
  getDocumentForOrg,
  getDocumentDataForOrg,
  getDocumentTypeByNameForOrg,
  updateDocumentDataForOrg,
  indexDocument,
} from "@zdocs/db-schema";
import type {
  UpdateEntityFieldsResponse,
  EntityObj,
  UiTxNotification,
} from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

interface UpdateEntityFieldsParams {
  orgId: string; // Required but validated at route level
  entityId: string;
  fields: Record<string, unknown>; // Field name -> value mapping
}

/**
 * Update fields in an entity (header or line item)
 */
export async function handleUpdateEntityFields(
  context: UiTxContext,
  params: UpdateEntityFieldsParams
): Promise<UpdateEntityFieldsResponse> {
  const { orgId } = context;
  const { entityId, fields } = params;

  if (!entityId) {
    throw new Error("entityId is required");
  }

  if (!fields || Object.keys(fields).length === 0) {
    throw new Error("fields are required");
  }

  // Parse entityId to get documentId and determine if it's header or line item
  // Format: documentId (header) or documentId_collectionKey_index (line item)
  const parts = entityId.split("_");
  const documentId = parts[0]; // First part is always documentId
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

  // Get document type schema for validation
  const docTypeRecord = await getDocumentTypeByNameForOrg(
    document.docType,
    orgId
  );
  if (!docTypeRecord) {
    throw new Error("Document type schema not found");
  }

  // Get schema for the entity (header or line item)
  let schema = docTypeRecord.headerSchema;
  if (isLineItem && collectionKey) {
    const collectionSchema = docTypeRecord.lineItemSchemas?.[collectionKey];
    if (!collectionSchema) {
      throw new Error(
        `Line item schema not found for collection: ${collectionKey}`
      );
    }
    schema = collectionSchema.fields;
  }

  // Validate field names against schema
  const schemaFieldNames = new Set(schema.map((f) => f.name));
  const invalidFields: string[] = [];
  const notifications: UiTxNotification[] = [];

  for (const fieldName of Object.keys(fields)) {
    if (!schemaFieldNames.has(fieldName)) {
      invalidFields.push(fieldName);
      notifications.push({
        level: "warning",
        message: `Field "${fieldName}" is not in schema and will be ignored`,
        fieldPath: fieldName,
      });
    }
  }

  // Filter out invalid fields
  const validFields: Record<string, unknown> = {};
  for (const [fieldName, value] of Object.entries(fields)) {
    if (schemaFieldNames.has(fieldName)) {
      validFields[fieldName] = value;
    }
  }

  if (Object.keys(validFields).length === 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "No valid fields to update",
      },
    };
  }

  // Update entity data
  if (isLineItem && collectionKey && index !== undefined) {
    // Update line item
    const lineItems =
      (documentData.lineItems as Record<string, Record<string, unknown>[]>) ||
      {};

    if (!lineItems[collectionKey]) {
      throw new Error("Line item collection not found");
    }

    const collection = lineItems[collectionKey];
    if (!Array.isArray(collection) || !collection[index]) {
      throw new Error("Line item not found");
    }

    // Update the line item fields
    collection[index] = {
      ...collection[index],
      ...validFields,
    };

    // Update document data
    await updateDocumentDataForOrg(orgId, documentId, {
      lineItems: {
        ...lineItems,
        [collectionKey]: collection,
      },
    });
  } else {
    // Update header
    const headerData =
      (documentData.headerData as Record<string, unknown>) || {};

    await updateDocumentDataForOrg(orgId, documentId, {
      headerData: {
        ...headerData,
        ...validFields,
      },
    });
  }

  // Re-index the document to update search index
  await indexDocument(documentId, orgId);

  // Audit log
  console.log(
    `[uiTx] Updated entity fields: orgId=${orgId}, entityId=${entityId}, fields=${Object.keys(
      validFields
    ).join(",")}`
  );

  return {
    ok: true,
    notifications: notifications.length > 0 ? notifications : undefined,
  };
}
