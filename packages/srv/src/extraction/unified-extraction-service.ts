/**
 * Unified Extraction Service
 * 
 * This file re-exports all extraction-related functionality from separate modules
 * to maintain backward compatibility with existing imports.
 */

// Re-export types
export type {
  ExtractedDocumentData,
  ExtractDocumentDataParams,
  ExtractDocumentDataResult,
} from "./types";

// Re-export data cleaning utilities
export {
  cleanNullStrings,
  cleanLineItemsNullStrings,
} from "./data-cleaning";

// Re-export Zod schema builder utilities
export {
  fieldTypeToJsonType,
  fieldToZod,
  buildZodSchema,
} from "./zod-schema-builder";

// Re-export folder context helpers
export { buildFolderContext } from "./folder-context";

// Re-export response schema builders
export {
  buildHeaderResponseSchema,
  buildLineItemsResponseSchema,
  buildFullResponseSchema,
} from "./response-schema-builders";

// Re-export prompt builders
export {
  buildExtractionPrompt,
  buildExtractionPromptHeaders,
  buildExtractionPromptLineItems,
} from "./prompt-builders";

// Re-export main extraction service functions
export {
  extractMultiPageDocumentData,
  extractDocumentData,
} from "./extraction-service";
