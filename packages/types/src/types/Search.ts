/**
 * Search index interface - stores only searchable content, NOT metadata
 * Metadata is fetched from source tables at query time
 */
export interface BaseSearchIndex extends EntityObj, EntityPreview {
  orgId: string;
  content: string; // Plain text for searching
  /** True when the user has manually marked this line item as a duplicate */
  isDuplicate: boolean;
}
export interface SearchIndex extends BaseSearchIndex {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Searchable entity option for entity selector dropdown
 * Represents either a document header or a specific line item collection
 */
export interface SearchableEntityOption extends EntityRef {
  /** Whether this is a dataset */
  isDataset: boolean;
  /** Display name: "Invoice" for headers, "Invoice Items" for line items */
  displayName: string;
  /** The schema fields for this entity */
  schema: FieldDefinition[];
}


export interface MultiEntitySearchResponse extends EntityResponseList {
  /** The entity that was searched */
  entities: SearchableEntityOption[];
}

/**
 * State for a single entity's search in the frontend store
 */
export interface EntitySearchState extends EntityResponseList {
  entity: SearchableEntityOption;
  loading: boolean;
  error: string | null;
  offset: number;
}

// Graph settings for visualization
export const GRAPH_CHART_TYPES = ["bar", "line", "scatter"] as const;
export type GraphChartType = (typeof GRAPH_CHART_TYPES)[number];

export const GRAPH_AGGREGATION_MODES = ["value", "sum", "count"] as const;
export type GraphAggregationMode = (typeof GRAPH_AGGREGATION_MODES)[number];

export interface GraphSettings {
  xColumn: string;
  yColumn: string;
  chartType: GraphChartType;
  aggregationMode: GraphAggregationMode;
}

// Date range shortcut options (in months)
export const DATE_RANGE_SHORTCUTS = [3, 6, 12] as const;
export type DateRangeShortcut = (typeof DATE_RANGE_SHORTCUTS)[number];
export type QuickRangeOption = DateRangeShortcut | null;

// Saved Query filters interface
export interface SavedQueryFilters {
  /** Selected searchable schema types (e.g., "INVOICE_header", "INVOICE_items") */
  schemaTypes?: string[];
  graphSettings?: GraphSettings;
  /** Date range shortcut in months (3, 6, or 12). When set, applies relative to current date. */
  dateRangeShortcut?: DateRangeShortcut;
  /** Selected result tab key (e.g., "INVOICE_header", "INVOICE_items", or "all") */
  activeTabKey?: string;
}

// Saved Query interface
export interface SavedQuery {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  query: string;
  filters: SavedQueryFilters | null;
  createdAt: Date;
  updatedAt: Date;
}

import {
  EntityPreview,
  EntityObj,
  EntityRef,
  EntityResponseList,
} from "./Entity";
// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED SEARCH TYPES - Per-Entity Parallel Search
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from "./FieldDefinition";

/**
 * Request for per-entity search
 */
export interface EntitySearchRequest {
  /** Search query string */
  query: string;
  /** The entity to search */
  entity: SearchableEntityOption;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by document date - start date (ISO string) */
  dateFrom?: string;
  /** Filter by document date - end date (ISO string) */
  dateTo?: string;
  /** Whether to exclude items that are already reconciled with the target entity */
  excludeReconciled?: boolean;
  /** The entity of the opposing side (for reconciliation filtering) */
  reconciliationTargetEntity?: SearchableEntityOption;
  /** When true, disables fuzzy/trigram matching - only exact text matches */
  exactMatch?: boolean;
}


/**
 * Multi-query search options - allows AI agents to run complex queries
 * Each query in the array is ORed together
 */
export interface SearchByEntityOptionsBase {
  orgId: string;
  limit?: number;
  offset?: number;
  /** Structured filters for common search fields */
  filters?: {
    /** Preview data filters - filter on indexed preview fields */
    preview?: {
      date?: { gte?: string; lte?: string };
      amount?: { gte?: number; lte?: number };
      currency?: string | string[];
    };
    /** Entity filters - filter on entity metadata (exact matching) */
    entity?: {
      entityId?: string | string[];
      documentId?: string | string[];
      entityType?: "HEADER" | "LINE_ITEM" | Array<"HEADER" | "LINE_ITEM">;
      docType?: string | string[];
      schemaType?: string | string[];
      collectionKey?: string | string[];
      folderId?: string | string[];
      isDataset?: boolean;
    };
  };
  excludeReconciled?: boolean;
  reconciliationTargetEntity?: SearchableEntityOption;
  /** When true, disables fuzzy/trigram matching - only exact text matches */
  exactMatch?: boolean;
  /** Optional structured where clauses (ANDed with queries) - filter on schema-specific JSONB fields */
  where?: Array<{
    schemaType: string;
    field: string;
    op: "=" | "in" | ">" | ">=" | "<" | "<=" | "contains";
    value: unknown;
  }>;
  /** Sort order for results */
  sort?: Array<{
    field: "date" | "amount" | "relevance";
    order: "asc" | "desc";
  }>;
}

export interface SearchByEntityOptions extends SearchByEntityOptionsBase {
  query: string;

}

/**
 * Multi-query search options - allows AI agents to run complex queries
 * Each query in the array is ORed together
 */
export interface SearchByEntityMultiQueryOptions extends SearchByEntityOptionsBase {
  /** Array of search queries - results matching ANY query will be returned */
  queries: string[];

}

export interface CreateSavedQueryParams {
  orgId: string;
  userId: string;
  name: string;
  query: string;
  filters: SavedQueryFilters | null;
}

export interface UpdateSavedQueryParams {
  id: string;
  orgId: string;
  userId: string;
  name?: string;
  query?: string;
  filters?: SavedQueryFilters | null;
}
