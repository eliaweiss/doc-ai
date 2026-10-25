// HEADER: Header-level fields from document
// LINE_ITEM: Line item fields from document
export const ENTITY_TYPES = ["HEADER", "LINE_ITEM"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Base entity reference for all entities
 */
export interface EntityRef {
  /** Document type name (e.g. "INVOICE", "BANK_STATEMENT") */
  docType: string;
  /** Compound schema identifier: "{docType}_header" or "{docType}_{collectionKey}",eg, "INVOICE_header", "INVOICE_items" */
  schemaType: string;
  /** Whether this is a header or line item,  "HEADER" | "LINE_ITEM" */
  entityType: EntityType;
  /** Collection key for line items (null for headers),  eg, "items", "transactions", null */
  collectionKey: string | null;
  /** For line items: position in collection */
  index?: number;
  /** Whether the source document is a dataset */
  isDataset: boolean;
}

/**
 * Entity reference for a DB object
 */
export interface EntityObj extends EntityRef {
  entityId: string;
  documentId: string;
  date: string;
}

/**
 * Entity preview for a DB object
 */
export interface EntityPreview {
  date: string;
  description: string;
  amount: number;
  currency: string;
}

/**
 * file metadata currently contain the original file name
 * NOTE - currently all data is associated with a file, but in the future the system might extend to external data source thus the file data in optional
 */
export interface FileMetadata {
  fileName: string;
}

/**
 * Entity response for a DB object
 */
export interface EntityResponse {
  ref: EntityObj;
  preview: EntityPreview;
  file?: FileMetadata;
  data: Record<string, unknown>;
}

/**
 * Search entities response
 */
export interface EntityResponseList {
  /** Search results */
  results: EntityResponse[];
  /** Total count (for pagination) */
  total: number;
  /** Whether there are more results to fetch */
  hasMore: boolean;
}
