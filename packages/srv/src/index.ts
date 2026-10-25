/**
 * @zdocs/srv (doc-ai trimmed copy)
 *
 * Classification / extraction pipeline copied from zdocs. Billing, S3 and
 * HTTP self-dispatch are replaced by local shims (ai/*, extraction/s3-cache.ts,
 * services/task-scheduler.ts); local/ is new.
 */
export {
  getFromCache,
  getJsonFromCache,
  saveToCache,
  saveJsonToCache,
  fetchDocumentFromS3,
  deleteCacheByPrefix,
  LOCAL_BUCKET,
  CACHE_BUCKET,
} from "./extraction/s3-cache";
export { isBinarySpreadsheetFile, isSpreadsheetFile } from "./extraction/isSpreadsheetFile";
export { spreadsheetToText } from "./extraction/dataset-to-text";
export { validateDocumentUploadSize } from "./storage/file-utils";
export { FileSizeLimitError } from "./storage/file-size-limits";

export * from "./pipeline";
export { getModelProviderForOrg, type ModelProviderResult } from "./ai/ai-key-provider";
export { getContentTypeFromExtension } from "./storage/file-utils";
export * from "./ui-tx";
export { uiTxSearchEntitiesPrompt } from "./chat/ui-tx-prompt-docs/ui-tx-searchEntities-prompt";
export { uiTxGeneralPrompt } from "./chat/ui-tx-prompt-docs/ui-tx-general-prompt";
export {
  getConfig,
  readSettings,
  writeSettings,
  type DocAiConfig,
  type LocalSettings,
  type ProviderKind,
} from "./local/config";
export { resolveDocumentPath, getCacheDir } from "./local/paths";
export { evaluateFormulas } from "./extraction/formula-service";
export { enrichLineItemsWithMetadata } from "./services/document-service";
