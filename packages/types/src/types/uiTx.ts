/**
 * uiTx SDK Types
 *
 * Types for the uiTx capability-based client SDK.
 * Shared between client SDK and server handlers.
 */

import type { EntityObj } from "./Entity";
import type { ReconciliationPairObj } from "./Reconciliation";
import type { FieldDefinition } from "./FieldDefinition";

/**
 * Notification from uiTx operations
 */
export interface UiTxNotification {
  level: "info" | "warning" | "error";
  message: string;
  fieldPath?: string;
  code?: string;
}

/**
 * Standard error response
 */
export interface UiTxError {
  code:
    | "VALIDATION_ERROR"
    | "PERMISSION_DENIED"
    | "RATE_LIMITED"
    | "NOT_FOUND"
    | "UNSUPPORTED"
    | "INTERNAL_ERROR";
  message: string;
  details?: unknown;
}

/**
 * Session info returned by getSession()
 */
export interface UiTxSession {
  orgId: string;
  orgCurrency: string;
  permissions: string[];
  mode: "embedded" | "http";
  appId?: string;
  runId: string;
}

/**
 * Get entity response
 */
export interface GetEntityResponse {
  ref: EntityObj;
  data: Record<string, unknown>;
  schema: FieldDefinition[];
  document?: {
    id: string;
    folderId?: string;
    currency?: string;
    documentDate?: string;
    description?: string;
  };
}

/**
 * List documents response
 */
export interface ListDocumentsResponse {
  total: number;
  documents: Array<{
    id: string;
    docType: string;
    documentDate?: string;
    description?: string;
    currency?: string;
    totalAmount?: number;
    folderId?: string;
    extractionStatus: string;
  }>;
}

/**
 * Query response
 */
export interface QueryResponse {
  rows: Record<string, unknown>[];
}

/**
 * Aggregate response
 */
export interface AggregateResponse {
  rows: Array<Record<string, unknown>>;
  /** Defaults the query applied that the caller didn't ask for */
  notes?: string[];
}

/**
 * Update entity fields response
 */
export type UpdateEntityFieldsResponse =
  | { ok: true; notifications?: UiTxNotification[] }
  | { ok: false; error: UiTxError };

/**
 * Create reconciliation link response
 */
export type CreateReconciliationLinkResponse =
  | { ok: true; linkId: string }
  | { ok: false; error: UiTxError };

/**
 * List reconciliation links response
 */
export interface ListReconciliationLinksResponse {
  links: ReconciliationPairObj[];
}

/**
 * Trace reconciliation response
 */
export interface TraceReconciliationResponse {
  nodes: Array<{ ref: EntityObj; data: Record<string, unknown> }>;
  edges: Array<{
    source: string;
    target: string;
    amount: number;
    currency: string;
  }>;
  summary: {
    totalPaths: number;
    matchingPaths: number;
    maxDepthReached: number;
    truncated: boolean;
  };
}

/**
 * UI helpers response types
 */
export interface ConfirmResponse {
  confirmed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSPORT TYPES (shared between client SDK and server handlers)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request envelope sent through transport
 */
export interface UiTxRequest<T = unknown> {
  type: string; // Method name: "searchEntities", "getEntity", etc.
  payload: T;
  requestId: string;
}

/**
 * Response envelope received from transport
 */
export interface UiTxResponse<T = unknown> {
  type: "UITX_RESPONSE"; // Discriminator for postMessage filtering
  requestId: string;
  ok: boolean;
  result?: T;
  error?: UiTxError;
}
