import { ReconciliationObjRef, ToleranceReconcileMapping } from "./Reconciliation";
import { DateRangeShortcut, SearchableEntityOption } from "./Search";


/**
 * Options/filters for a reconciliation session
 * Stored as JSONB to allow flexible extension
 */
export interface GridColumnState {
  colId: string;
  width?: number;
  hide?: boolean;
  pinned?: "left" | "right" | null;
}

export interface ReconciliationSessionOptions {
  hideReconciled?: boolean;
  hideDuplicates?: boolean;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  dateRangeShortcut?: DateRangeShortcut; // Quick range in months (3, 6, or 12)
  sourceEntityKeys?: string[];
  targetEntityKeys?: string[];
  sourceColumnState?: GridColumnState[];
  targetColumnState?: GridColumnState[];
  // Manual tolerance overrides per source/target field pair.
  // These take precedence over auto-computed values from past links.
  fieldMappingOverrides?: ToleranceReconcileMapping;
}


/**
 * Saved reconciliation session with full entity objects (API response type)
 */
export interface SavedReconciliationSession {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  description?: string | null;
  sourceEntity: SearchableEntityOption;
  sourceEntities?: SearchableEntityOption[];
  sourceQuery: string;
  sourceDateFrom?: string | null;
  sourceDateTo?: string | null;
  targetEntity: SearchableEntityOption;
  targetEntities?: SearchableEntityOption[];
  targetQuery: string;
  targetDateFrom?: string | null;
  targetDateTo?: string | null;
  amount?: string | null;
  currency?: string | null;
  options?: ReconciliationSessionOptions | null;
  createdAt: Date;
  updatedAt: Date;
}



/**
 * Input for creating a new link
 */
export interface CreateReconciliationLinkInput {
  sourceRef: ReconciliationObjRef;
  targetRef: ReconciliationObjRef;
  amount: string | number;
  currency: string;
  date: string;
  type?: "manual" | "suggested";
  confidence?: number;
  metadata?: Record<string, unknown>;
}


/**
 * Options/filters for a ledger trace session
 */
export interface LedgerTraceSessionOptions {
  startSchemaTypes?: string[];
  endSchemaTypes?: string[];
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  dateRangeShortcut?: DateRangeShortcut;
  maxDepth?: number;
  limit?: number;
}

/**
 * Saved ledger trace session
 */
export interface SavedLedgerTraceSession {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  description?: string | null;
  options: LedgerTraceSessionOptions;
  createdAt: Date;
  updatedAt: Date;
}