import type { DocumentTypeRecord, Document } from "@zdocs/types";

export interface ExtractedDocumentData {
  headerData: Record<string, unknown>;
  lineItems: Record<string, Record<string, unknown>[]> | null;
  selectedFolder?: string | null;
}

export interface ExtractDocumentDataParams {
  /** The document to extract data from */
  document: Document;
  /** Whether to force re-extraction */
  forceReExtract?: boolean;
  /** Whether this is a retry after a previous failure (keeps cached pages instead of clearing them) */
  isRetry?: boolean;
}

/** Result from extractDocumentData including the resolved document type */
export interface ExtractDocumentDataResult {
  /** The resolved document type with schema */
  documentType: DocumentTypeRecord;
  /** The extracted data */
  extractedData: ExtractedDocumentData;
}
