/**
 * @zdocs/db-schema (doc-ai trimmed copy)
 *
 * Org-scoped query functions copied from zdocs. Only the modules doc-ai needs
 * are kept: documents, document types, folders, queue, notifications, search,
 * AI usage, mini-apps. Auth, billing, integrations and tasks were removed.
 *
 * db.ts is replaced by an embedded PGlite instance; local.ts is new.
 */
export {
  zdocsDb,
  pgliteClient,
  closeDatabase,
  openDatabase,
  getOpenWorkspaceDir,
  runTransaction,
  extractRows,
  extractRowCount,
  type TransactionClient,
} from "./db";

export * from "./queries/documents";
export * from "./queries/documents-utils";
export * from "./queries/document-types";
export * from "./queries/document-metadata";
export * from "./queries/formula-schema";
export * from "./queries/folders";
export * from "./queries/queue";
export * from "./queries/process-locks";
export * from "./queries/notifications";
export * from "./queries/datasets";
export * from "./queries/ai-usage";
export * from "./queries/search";
export * from "./queries/organizations";
export * from "./queries/quick-access";
export * from "./queries/setLineItemDuplicate";
export * from "./queries/ai-model-settings";
export * from "./queries/local";
export * from "./queries/mini-apps";
export * from "./queries/mini-apps-history";
export * from "./queries/reconciliation";
