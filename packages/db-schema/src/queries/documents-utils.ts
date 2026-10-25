import { getDateStr } from "@zdocs/util";
import {
  getDenormalizedValues,
  type FieldDefinition,
  type Document,
  type DocumentData,
  LineItemCollectionSchema,
} from "@zdocs/types";

/**
 * Ensures a document always has base data (description, currency, documentDate) by
 * applying fallback logic from headerData and denormalized mappings.
 * 
 * Priority for each field:
 * - description: headerData.description -> denormalized description -> document.description
 * - currency: headerData.currency -> denormalized currency -> document.currency
 * - documentDate: documentData.documentDate -> headerData.date -> denormalized date -> document.documentDate
 * - totalAmount: documentData.totalAmount
 * 
 * @param headerData - The header data extracted from the document
 * @param documentData - The document data containing extracted info
 * @param document - The existing document record (may have partial data)
 * @param headerSchema - Optional header schema for denormalized field resolution
 * @returns Object with description, currency, documentDate to update on document
 */
export function ensureDocumentBaseData(
  headerData: Record<string, unknown> | null | undefined,
  documentData: {
    totalAmount?: number | null;
    documentDate?: string | null;
  },
  document: Document,
  headerSchema?: FieldDefinition[]
): {
  description: string | null;
  currency: string | null;
  documentDate: string | null;
} {
  const denormalized = headerData && headerSchema
    ? getDenormalizedValues(headerData, headerSchema)
    : null;

  const description =
    (headerData?.description as string) ||
    denormalized?.description ||
    document.description ||
    null;

  const currency =
    (headerData?.currency as string) ||
    denormalized?.currency ||
    document.currency ||
    null;

  const documentDate =
    getDateStr(documentData.documentDate) ||
    getDateStr(headerData?.date as string) ||
    getDateStr(denormalized?.date) ||
    getDateStr(document.documentDate) ||
    getDateStr(document.createdAt) ||
    null;

  return {
    description,
    currency,
    documentDate,
  };
}

export function ensureItemBaseData(
  item: Record<string, unknown>,
  collectionSchema: LineItemCollectionSchema,
  documentData: DocumentData,
  document: Document
): {
  date: string;
  currency: string;
  amount: number;
  description: string;
} {
  // Ensure item always has a date using priority fallback
  const date = ensureLineItemDate(
    item,
    collectionSchema.fields,
    documentData,
    document
  );

  // Ensure item always has a currency using priority fallback
  const currency = ensureLineItemCurrency(
    item,
    collectionSchema.fields,
    documentData,
    document
  );

  // Ensure item always has an amount using priority fallback
  const amount = ensureLineItemAmount(
    item,
    collectionSchema.fields,
    documentData,
    document
  );

  // Ensure item always has a description using priority fallback
  const description = ensureLineItemDescription(
    item,
    collectionSchema.fields,
    documentData,
    document
  );

  return {
    date: date!,
    currency: currency || "",
    amount: amount || 0,
    description: description || "",
  };
}

/**
 * Ensures a line item always has a date by following a priority fallback chain:
 * 1. entity date (item.date)
 * 2. denormalized date
 * 3. any date field in the schema
 * 4. document extracted date (documentData.documentDate)
 * 5. document date (document.documentDate)
 * 6. upload date (document.createdAt)
 *
 * @param item - The line item object
 * @param collectionSchemaFields - Array of field definitions for the collection schema
 * @param documentData - The complete document_data object
 * @param document - The complete document object
 * @returns A valid date string (YYYY-MM-DD format) or null if all fallbacks fail
 */
function ensureLineItemDate(
  item: Record<string, unknown>,
  collectionSchemaFields: FieldDefinition[],
  documentData: DocumentData,
  document: Document
): string | null {
  // Date priority:
  // 1. entity date,
  // 2. denormalized date,
  // 3. any date field,
  // 4. document extracted date,
  // 5. document date,
  // 6. upload date
  let date = getDateStr(item.date as string); // (1)

  if (!date) {
    // (2) denormalized date
    const denormalized = getDenormalizedValues(item, collectionSchemaFields);
    date = getDateStr(denormalized.date as string);
  }

  if (!date) {
    // (3) any date field - find first valid one
    for (const f of collectionSchemaFields) {
      if (f.type === "date") {
        const fieldDate = getDateStr(item[f.name] as string);
        if (fieldDate) {
          date = fieldDate;
          break; // stop at first valid date
        }
      }
    }
  }

  if (!date) {
    // (4), (5), (6) document-level fallbacks
    date =
      getDateStr(documentData.documentDate) ||
      getDateStr(document.documentDate) ||
      getDateStr(document.createdAt);
  }

  return date || null;
}

/**
 * Ensures a line item always has a currency by following a priority fallback chain:
 * 1. entity currency (item.currency)
 * 2. denormalized currency
 * 3. currency fields in the schema (if all match, use the first one)
 * 4. document currency (document.currency)
 *
 * @param item - The line item object
 * @param collectionSchemaFields - Array of field definitions for the collection schema
 * @param documentData - The complete document_data object
 * @param document - The complete document object
 * @returns A valid currency string or undefined if all fallbacks fail
 */
function ensureLineItemCurrency(
  item: Record<string, unknown>,
  collectionSchemaFields: FieldDefinition[],
  documentData: DocumentData,
  document: Document
): string | undefined {
  // Currency priority:
  // 1. entity currency,
  // 2. denormalized currency,
  // 3. currency fields (if all match),
  // 4. document currency
  let currency = item.currency as string; // (1)

  if (!currency) {
    // (2) denormalized currency
    const denormalized = getDenormalizedValues(item, collectionSchemaFields);
    currency = denormalized.currency as string;
  }

  if (!currency) {
    // (3) collect all currencies from currency fields
    const currencies: string[] = [];
    for (const f of collectionSchemaFields) {
      if (f.type === "currency" && f.currencyField) {
        const currencyValue = item[f.currencyField] as string;
        if (currencyValue) {
          currencies.push(currencyValue);
        }
      }
    }

    // if all currencies are the same, use the first one
    if (currencies.length > 0 && currencies.every((c) => c === currencies[0])) {
      currency = currencies[0];
    }
  }

  if (!currency) {
    // (4) document-level fallback
    currency = document.currency as string;
  }

  return currency || undefined;
}

/**
 * Ensures a line item always has an amount by following a priority fallback chain:
 * 1. entity amount (item.amount)
 * 2. denormalized amount
 * 3. any currency field in the schema (find first one)
 * 4. document total amount (documentData.totalAmount)
 *
 * @param item - The line item object
 * @param collectionSchemaFields - Array of field definitions for the collection schema
 * @param documentData - The complete document_data object
 * @param document - The complete document object
 * @returns A valid amount number or undefined if all fallbacks fail
 */
function ensureLineItemAmount(
  item: Record<string, unknown>,
  collectionSchemaFields: FieldDefinition[],
  documentData: DocumentData,
  document: Document
): number | undefined {
  // Amount priority:
  // 1. entity amount,
  // 2. denormalized amount,
  // 3. any currency field,
  // 4. document total amount
  let amount = item.amount as number; // (1)

  if (!amount) {
    // (2) denormalized amount
    const denormalized = getDenormalizedValues(item, collectionSchemaFields);
    amount = denormalized.amount as number;
  }

  if (!amount) {
    // (3) find first currency field
    for (const f of collectionSchemaFields) {
      if (f.type === "currency") {
        const fieldAmount = item[f.name] as number;
        if (fieldAmount) {
          amount = fieldAmount;
          break; // stop at first valid amount
        }
      }
    }
  }

  if (!amount) {
    // (4) document-level fallback
    amount = documentData.totalAmount!;
  }

  return amount || undefined;
}

/**
 * Ensures a line item always has a description by following a priority fallback chain:
 * 1. entity description (item.description)
 * 2. denormalized description
 * 3. isDescription field in the schema
 * 4. document description (document.description)
 *
 * @param item - The line item object
 * @param collectionSchemaFields - Array of field definitions for the collection schema
 * @param documentData - The complete document_data object
 * @param document - The complete document object
 * @returns A valid description string or undefined if all fallbacks fail
 */
function ensureLineItemDescription(
  item: Record<string, unknown>,
  collectionSchemaFields: FieldDefinition[],
  documentData: DocumentData,
  document: Document
): string {
  // Description priority:
  // 1. entity description,
  // 2. denormalized description,
  // 3. isDescription field,
  // 4. document description
  let description = item.description as string; // (1)

  if (!description) {
    // (2) denormalized description
    const denormalized = getDenormalizedValues(item, collectionSchemaFields);
    description = denormalized.description as string;
  }

  if (!description) {
    // (3) find isDescription field
    const descriptionField = collectionSchemaFields.find(
      (f) => f.isDescription
    );
    if (descriptionField) {
      description = item[descriptionField.name] as string;
    }
  }
  if (!description) {
    // first string field in the schema
    for (const f of collectionSchemaFields) {
      if (f.type === "text") {
        description = item[f.name] as string;
        break;
      }
    }
  }

  if (!description) {
    // (4) document-level fallback
    description = document.description as string;
  }

  return description || "";
}
