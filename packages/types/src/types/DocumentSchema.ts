import { DenormalizedAsType, FieldDefinition } from "./FieldDefinition";
import { DocumentNotification } from "./Notification";

// ═══════════════════════════════════════════════════════════════════════════════
// LINE ITEM COLLECTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Defines a single collection of line items within a document
 * Used for documents with multiple tables (e.g., Investment Statement has holdings, activities)
 */
export interface LineItemCollectionSchema {
  /** Collection identifier: "INVOICE_LINE_ITEM", "HOLDINGS", "ACTIVITIES" */
  name: string;

  /** UI label: "Invoice Items", "Holdings", "Activities" */
  displayName: string;

  /** For AI extraction: "Individual line items from the invoice" */
  description?: string;

  /** The fields within each item */
  fields: FieldDefinition[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLDER MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface FolderMapping {
  folderId: string;
  extractionHint: string;
  transactionType?: TransactionType | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reference to a sample document uploaded to S3 for schema generation
 */
export interface SampleDocument {
  s3Key: string;
  fileName: string;
  contentType: string;
  s3Region: string;
  s3Bucket: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT TYPE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete document type schema stored in document_types table
 */
export interface DocumentTypeSchema {
  isDataset?: boolean;

  /** Type identifier: "INVOICE", "UTILITY_BILL" */
  name: string;

  /** UI display name: "Invoice", "Utility Bill" */
  displayName: string;

  /** Description for AI classification */
  description: string;

  /** Schema for header/main document fields */
  headerSchema: FieldDefinition[];

  /**
   * Line item schemas - named collections of line items
   * Each key is the collection key (e.g., "items", "holdings", "activities")
   * null/undefined means no line items for this document type
   */
  lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT TYPE (DATABASE RECORD)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Document type record from document_types table
 */
export interface DocumentTypeRecord {
  id: string;

  /** Schema version - increments when headerSchema or lineItemSchemas change */
  entityVersion: number;

  /** Organization ID - every type belongs to an org (multi-tenant) */
  orgId: string;

  /** Type identifier: "INVOICE", "UTILITY_BILL" */
  name: string;

  /** UI display name: "Invoice", "Utility Bill" */
  displayName: string | null;

  /** Description for AI classification */
  description: string | null;

  /** Extraction hint for AI classification */
  extractionHint: string | null;

  /** Tracks which system template this type originated from (for bulk updates) */
  templateName: string | null;

  /** Schema for header fields */
  headerSchema: FieldDefinition[];

  /** Schema for line items - named collections */
  lineItemSchemas: Record<string, LineItemCollectionSchema> | null;

  /**
   * If true, this is a Dataset type (not a regular document type)
   * Datasets:
   * - Have no headerSchema (empty array)
   * - Are extracted via code (not AI) - skip ai_processing_queue
   * - Line items come from Excel/CSV rows
   * - Schema is auto-generated from file headers
   */
  isDataset: boolean | null;

  /** Originated from system template */
  isSystem: boolean | null;

  /** Default folder for documents of this type */
  defaultFolderId: string | null;

  /** Folder mappings for AI-driven folder selection */
  folderMapping: FolderMapping[] | null;

  /** Icon name for UI */
  icon: string | null;

  /** Hex color for UI */
  color: string | null;

  /** Sample documents used for schema generation */
  sampleDocuments: SampleDocument[] | null;

  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT DATA (DATABASE RECORD)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Document data record from document_data table
 * Note: docType is stored in documents table, not here
 */
export interface DocumentData {
  id: string;
  orgId: string;
  documentId: string;

  /** The version of the document type schema used for this extraction */
  schemaEntityVersion: number;

  /** Header data - validated against document_types.headerSchema */
  headerData: Record<string, unknown> | null;

  /**
   * Line items - named collections matching lineItemSchemas keys
   * Example: { items: [...], fees: [...], taxes: [...] }
   */
  lineItems: Record<string, Record<string, unknown>[]> | null;

  // Denormalized fields for fast filtering
  totalAmount: number | null;
  transactionType: TransactionType | null;
  documentDate: string | null;
  dueDate: string | null;
  baseAmount: number | null;

  /**
   * Notifications generated by formula fields.
   * For warning/error: includes id referencing notifications table
   * For info: no id, not persisted to notifications table
   */
  notifications: DocumentNotification[] | null;

  // Soft delete
  deletedAt: Date | null;
  documentDeletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const COMPUTED_FIELD_TYPES: ReadonlySet<string> = new Set(["sum", "code"]);

/**
 * Filter fields to only include AI-extractable ones.
 * Excludes fields explicitly marked aiExtractable: false AND
 * computed field types (sum, code) that are never extracted by AI.
 */
export function getAiExtractableFields(
  fields: FieldDefinition[]
): FieldDefinition[] {
  return fields.filter(
    (f) => f.aiExtractable !== false && !COMPUTED_FIELD_TYPES.has(f.type)
  );
}

/**
 * Get all searchable fields from a schema
 */
export function getSearchableFields(
  fields: FieldDefinition[]
): FieldDefinition[] {
  return fields.filter((f) => f.searchable === true);
}

/**
 * Get field by name from a schema
 */
export function getFieldByName(
  fields: FieldDefinition[],
  name: string
): FieldDefinition | undefined {
  return fields.find((f) => f.name === name);
}

/**
 * Get denormalized field mappings from a schema
 * Returns: { "total": "totalAmount", "date": "documentDate", ... }
 */
export function getDenormalizedMappings(
  fields: FieldDefinition[]
): Record<string, DenormalizedAsType> {
  const mappings: Record<string, DenormalizedAsType> = {};

  for (const field of fields) {
    if (field.denormalizedAs) {
      mappings[field.name] = field.denormalizedAs;
    }
  }

  return mappings;
}

/**
 * Get line items for a specific collection with guaranteed IDs.
 * Generates IDs for items that don't have them.
 *
 * @param lineItems - The line items record from document_data
 * @param zdocsTypeKey - The collection to get (e.g., "items", "holdings")
 */
export function getLineItemsForCollection(
  lineItems: Record<string, Record<string, unknown>[]> | null,
  zdocsTypeKey: string
): Record<string, unknown>[] {
  if (!lineItems) return [];

  const items = lineItems[zdocsTypeKey] || [];

  // Ensure all items have IDs (generate if missing)
  return items.map((item, index) => ({
    ...item,
    id: item.id ?? `${zdocsTypeKey}-${index}`,
  }));
}

/**
 * Get all collection keys from line items data
 */
export function getLineItemCollectionKeys(
  lineItems: Record<string, Record<string, unknown>[]> | null
): string[] {
  if (!lineItems) return [];
  return Object.keys(lineItems);
}
