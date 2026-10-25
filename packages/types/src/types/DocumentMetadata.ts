/**
 * Generic metadata record linking a document to integration-specific data.
 * The (documentId, type) pair is unique - each document can have one record per integration type.
 */
export interface DocumentMetadata {
  id: string;
  orgId: string;
  documentId: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const DOCUMENT_METADATA_TYPES = ["QB", "XERO"] as const;
export type DocumentMetadataType = (typeof DOCUMENT_METADATA_TYPES)[number];
