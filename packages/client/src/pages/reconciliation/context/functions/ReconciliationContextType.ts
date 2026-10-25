"use client";

import type { GridApi } from "ag-grid-community";
import {
  type EntityResponse,
  type FieldDefinition,
  type SavedReconciliationSession,
  type SearchableEntityOption,
  type DateRangeShortcut,
  type GridColumnState,
  type ReconciliationPairWithTolerance,
  type ReconciliationPairRef,
  type ToleranceReconcileMapping,
  type ToleranceReconcilePair
} from "@zdocs/types";

// Pane mode type - search or browse
export type ReconciliationPaneMode = "search" | "browse";

export interface ReconciliationContextType {
  // Sidebar visibility
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;

  // Pane mode (search or browse)
  sourcePaneMode: ReconciliationPaneMode;
  setSourcePaneMode: (mode: ReconciliationPaneMode) => void;
  targetPaneMode: ReconciliationPaneMode;
  setTargetPaneMode: (mode: ReconciliationPaneMode) => void;

  // Reconciled pairs
  reconciledPairs: ReconciliationPairRef[];
  resetReconciledPairs: () => void;
  addToReconciledPairs: (pairs: ReconciliationPairRef[]) => void;

  // Suggested pairs (for auto-reconcile detection)
  suggestedPairs: ReconciliationPairWithTolerance[];
  setSuggestedPairs: (pairs: ReconciliationPairWithTolerance[]) => void;

  // field sign mapping
  fieldReconcileMapping: ToleranceReconcileMapping;
  resetFieldReconcileMapping: () => void;
  addFieldReconcileMapping: (
    sourceFieldName: string,
    targetFieldName: string,
    mapping: ToleranceReconcilePair
  ) => void;
  getFieldReconcileMapping: (
    sourceFieldName: string,
    targetFieldName: string
  ) => ToleranceReconcilePair | undefined;

  // Manual user overrides for tolerance rules (per source/target field pair)
  fieldMappingOverrides: ToleranceReconcileMapping;
  updateFieldMappingOverride: (
    sourceFieldName: string,
    targetFieldName: string,
    updates: Partial<ToleranceReconcilePair>
  ) => void;


  // Source Search Params
  sourceEntity: SearchableEntityOption | null;
  setSourceEntity: (entity: SearchableEntityOption | null) => void;
  sourceEntities: SearchableEntityOption[];
  setSourceEntities: (entities: SearchableEntityOption[]) => void;
  sourceEntityName: string;
  setSourceEntityName: (name: string) => void;
  sourceQuery: string;
  setSourceQuery: (query: string) => void;
  sourceDateFrom: string | undefined;
  setSourceDateFrom: (date: string | undefined) => void;
  sourceDateTo: string | undefined;
  setSourceDateTo: (date: string | undefined) => void;
  leftSelection: EntityResponse[];
  setLeftSelection: (selection: EntityResponse[]) => void;
  sourceResults: EntityResponse[];
  setSourceResults: (results: EntityResponse[]) => void;
  // sourceResultsFiltered: EntityResponse[];
  sourceSchema: FieldDefinition[];
  setSourceSchema: (schema: FieldDefinition[]) => void;

  // Target Search Params
  targetEntity: SearchableEntityOption | null;
  setTargetEntity: (entity: SearchableEntityOption | null) => void;
  targetEntities: SearchableEntityOption[];
  setTargetEntities: (entities: SearchableEntityOption[]) => void;
  targetEntityName: string;
  setTargetEntityName: (name: string) => void;
  targetQuery: string;
  setTargetQuery: (query: string) => void;
  targetDateFrom: string | undefined;
  setTargetDateFrom: (date: string | undefined) => void;
  targetDateTo: string | undefined;
  setTargetDateTo: (date: string | undefined) => void;
  rightSelection: EntityResponse[];
  setRightSelection: (selection: EntityResponse[]) => void;
  targetResults: EntityResponse[];
  setTargetResults: (results: EntityResponse[]) => void;
  // targetResultsFiltered: EntityResponse[];
  targetSchema: FieldDefinition[];
  setTargetSchema: (schema: FieldDefinition[]) => void;

  // Data & Schema
  leftData: EntityResponse[];
  setLeftData: (data: EntityResponse[]) => void;
  rightData: EntityResponse[];
  setRightData: (data: EntityResponse[]) => void;
  leftSchema: FieldDefinition[];
  setLeftSchema: (schema: FieldDefinition[]) => void;
  rightSchema: FieldDefinition[];
  setRightSchema: (schema: FieldDefinition[]) => void;

  // Logic State
  amount: number | null;
  setAmount: (amount: number | null) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;

  // Sign toggle state (for opposite sign values)
  hasOppositeSign: boolean;
  signChoiceMade: boolean;
  matchedLeftValue: number | null;
  matchedRightValue: number | null;
  setAmountToPositive: () => void;
  setAmountToNegative: () => void;

  // Session
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
  selectedSessionName: string | null;
  setSelectedSessionName: (name: string | null) => void;
  loadedSessionTrigger: number;

  // Filter
  hideReconciled: boolean;
  setHideReconciled: (hide: boolean) => void;

  hideDuplicates: boolean;
  setHideDuplicates: (hide: boolean) => void;

  // Shared date filter (applies to both panes)
  sharedDateFrom: Date | null;
  setSharedDateFrom: (date: Date | null) => void;
  sharedDateTo: Date | null;
  setSharedDateTo: (date: Date | null) => void;
  sharedDateRangeShortcut: DateRangeShortcut | null;
  setSharedDateRangeShortcut: (range: DateRangeShortcut | null) => void;

  // Column State
  sourceColumnState: GridColumnState[] | null;
  targetColumnState: GridColumnState[] | null;
  getSourceColumnStateRef: React.MutableRefObject<
    (() => GridColumnState[]) | null
  >;
  getTargetColumnStateRef: React.MutableRefObject<
    (() => GridColumnState[]) | null
  >;

  // Handlers & Derivations
  handleSessionSelect: (
    sessionId: string,
    session: SavedReconciliationSession
  ) => void;
  handleCreateLink: () => Promise<void>;
  createLinksFromPairs: (pairs: ReconciliationPairWithTolerance[]) => Promise<void>;
  handleDeleteLink: () => Promise<void>;
  canLink: boolean;
  isCurrentSelectionLinked: boolean;

  // Grid API refs for scroll synchronization
  sourceGridApiRef: React.MutableRefObject<GridApi | null>;
  targetGridApiRef: React.MutableRefObject<GridApi | null>;
  scrollToAlignSelection: () => void;
  triggerLoadDocuments: number;
  setTriggerLoadDocuments: () => void;
  logDataToConsole: () => void;

  /** Patch the user-set duplicate flag on a single entity in raw source/target results */
  setEntityIsDuplicate: (entityId: string, isDuplicate: boolean) => void;
}
