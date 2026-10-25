// Extraction status enum values (runtime array for Drizzle)

import { OcrResultPtr } from "./OcrResult";

// Extraction pipeline flow: PENDING -> PARTIAL (after classification) -> EXTRACTED (after full extraction) -> INDEXED (after search indexing)
export const EXTRACTION_STATUSES = [
  "PENDING", // Document uploaded, no processing yet
  "PARTIAL", // Classified, document_data created with partial data
  "EXTRACTED", // Full extraction complete, document_data has complete data
  "INDEXED", // Search index updated
  "FAILED", // Processing failed at some stage
  "RETRYING", // Processing failed but will retry automatically
  "KEY_ERROR", // API key issue, will retry when key is fixed
] as const;

export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

// Classification result from AI preprocessing
export interface DocumentClassification {
  documentType: string;
  title: string | null;
  totalAmount: number | null;
  date: string | null; // ISO date string
}

export interface Document {
  id: string;
  orgId: string;
  folderId: string | null; // FK -> folders.id (null = root/unfiled)
  docType: string | null; // Document type name, e.g., "INVOICE". Null until classified.
  // File Information
  fileName: string | null;
  fileExtension: string | null;
  contentType: string; // MIME type (e.g., "application/pdf", "image/png")
  s3Key: string;
  contentHash: string | null;
  pageCount: number | null;
  processedPages: number[] | null;
  // Extraction State
  extractionVersion: string;
  extractionStatus: ExtractionStatus;
  lastExtractedAt: Date | null;
  lastIndexedAt: Date | null; // When search indexing last completed
  extractionErrors: Record<string, unknown> | null;
  // Counterparty (name is looked up from institutions table)
  institutionId: string | null;
  // Currency
  currency: string | null;
  exchangeRateToBase: string | null; // numeric stored as string
  // Description & Context
  description: string | null;
  // Document Date (extracted from document - invoice date, statement date, etc.)
  documentDate: string | null;
  // Storage Info
  s3Region: string; // AWS region where file is stored
  s3Bucket: string; // S3 bucket name
  // OCR Result
  ocrResultPtr: OcrResultPtr | null;
  // Upload State
  uploadComplete: boolean; // True when file upload to S3 is complete, triggers AI processing

  // Meta
  isTest: boolean; // Test documents for development/QA
  metadata: Record<string, unknown> | null;
  /**
   1|   * If true, this is a Dataset (collection of reference data)
   2|   * Datasets are documents that:
   3|   * - Have no headerSchema (empty array)
   4|   * - Are extracted via code (not AI)
   5|   * - Line items come from Excel/CSV rows
   6|   */
  isDataset: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
