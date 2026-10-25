/**
 * Request context for uiTx handlers (doc-ai trimmed copy).
 *
 * zdocs routes uiTx SDK requests through a switch here; doc-ai calls the
 * handlers directly from the MCP server, so only the context type is kept.
 * Reconciliation handlers are v2.
 */
export interface UiTxContext {
  orgId: string;
  authMethod: "session" | "api_key";
}
