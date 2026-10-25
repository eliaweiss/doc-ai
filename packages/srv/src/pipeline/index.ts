/**
 * Pipeline functions - Document processing pipeline
 *
 * These functions contain the business logic for document processing
 * and can be called from both Vercel routes and Lambda handlers.
 */

export {
  classifyDocument,
  type ClassifyDocumentParams,
  type ClassifyDocumentResult,
} from "./classify-document";

export {
  extractDocument,
  type ExtractDocumentParams,
  type ExtractDocumentResult,
} from "./extract-document";

