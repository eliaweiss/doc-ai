/**
 * ⚠️ INTERNAL - DO NOT IMPORT FROM OUTSIDE @zdocs/db-schema
 *
 * This barrel file is for internal use only.
 * All external access should go through the query functions in ../queries/
 */

// Auth
export {
  usersTbl,
  accountsTbl,
  sessionsTbl,
  verificationTokens,
} from "./auth";

// Organizations
export { organizationsTbl } from "./organizations";

// Document Types (requires orgId for all queries)
export { documentTypesTbl } from "./document-types";

// Documents
export { documentTbl, documentDataTbl } from "./documents";

// Folders
export { foldersTbl } from "./folders";

// Search
export { searchIndexTbl, savedQueryTbl } from "./search";

// Institutions
export { institutionsTbl } from "./institutions";

// Reconciliation
export {
  reconciliationLinksTbl,
  savedReconciliationSessionsTbl,
  savedLedgerTraceSessionsTbl,
} from "./reconciliation-links";

// AI
export { aiUsageLogsTbl, aiProcessingQueueTbl } from "./ai";

// Process Locks
export { processLockTbl } from "./process-locks";

// Notifications
export { notificationsTbl } from "./notifications";

// Document metadata
export { documentMetadataTbl } from "./document-metadata";

// Quick access (sidebar shortcuts used by the UI)
export { quickAccessTbl } from "./quick-access";

// Per-action model selection (doc-ai Settings → Processing)
export { aiModelSettingsTbl } from "./ai-model-settings";
