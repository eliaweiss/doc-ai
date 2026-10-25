import type { EntityResponseList, SearchByEntityOptions } from "@zdocs/types";
import { searchByEntityMultiQuery } from "./searchByEntityMultiQuery";

/**
 * Search for entities with a single query string
 *
 * Designed to run complex queries. Supports searching across a multiple entity types
 * with a single query string.
 *
 * Features:
 * - Single-query search: A single search query string is used to search across a single entity type
 * - multi-entity support: Can search across a multiple entity types in a single call
 * - Structured filtering: Supports date ranges, amounts, currencies, schema types, folders
 * - Reconciliation filtering: Can exclude already-reconciled entities
 * - Flexible where clauses: Programmatic filtering with various operators
 * - Pagination: Supports limit/offset for result pagination
 * - Sorting: Supports sorting by date, amount, or relevance
 *
 * @param options - Search configuration options
 * @param options.query - Single search query string. Results matching the query will be returned
 * @param options.orgId - Organization ID (required for multi-tenant isolation)
 * @param options.limit - Maximum number of results to return (default: 50)
 * @param options.offset - Number of results to skip for pagination (default: 0)
 * @param options.filters - Structured filters for common search fields
 * @param options.filters.preview - Preview data filters (indexed fields for fast filtering)
 * @param options.filters.preview.date - Date range filter (YYYY-MM-DD format)
 * @param options.filters.preview.date.gte - Start date (inclusive)
 * @param options.filters.preview.date.lte - End date (inclusive)
 * @param options.filters.preview.amount - Amount range filter
 * @param options.filters.preview.amount.gte - Minimum amount (inclusive)
 * @param options.filters.preview.amount.lte - Maximum amount (inclusive)
 * @param options.filters.preview.currency - Filter by currency code(s) (e.g., "USD", "EUR")
 * @param options.filters.entity - Entity metadata filters (exact matching)
 * @param options.filters.entity.entityId - Filter by entity ID(s) - for exact entity retrieval
 * @param options.filters.entity.documentId - Filter by document ID(s) - to find all entities (headers and line items) from specific document(s)
 * @param options.filters.entity.entityType - Filter by entity type(s) (e.g., "HEADER", "LINE_ITEM")
 * @param options.filters.entity.docType - Filter by document type(s) (e.g., "INVOICE", "BANK_STATEMENT")
 * @param options.filters.entity.schemaType - Filter by schema type(s) (e.g., "INVOICE_header", "INVOICE_items")
 * @param options.filters.entity.collectionKey - Filter by collection key(s) (e.g., "items", "transactions")
 * @param options.filters.entity.folderId - Filter by document folder ID(s)
 * @param options.filters.entity.isDataset - Filter by dataset flag (true/false)
 * @param options.where - Optional structured where clauses (ANDed with queries). Filters on schema-specific JSONB fields
 * @param options.where[].schemaType - REQUIRED: The schema type to filter on (e.g., "INVOICE_header", "INVOICE_items")
 *                                    For HEADER entities: filters on headerData JSONB fields
 *                                    For LINE_ITEM entities: returns ALL line items from documents where ANY item matches
 * @param options.where[].field - Field name to filter on - schema-specific field from headerData or lineItems
 *                                Examples for INVOICE_header: "invoiceNumber", "vendorName", "total"
 *                                Examples for INVOICE_items: "description", "amount", "quantity", "sku"
 * @param options.where[].op - Comparison operator: "=", "in", ">", ">=", "<", "<=", or "contains"
 * @param options.where[].value - Value to compare against (type depends on field and operator)
 * @param options.excludeReconciled - When true, excludes entities that are already reconciled
 * @param options.reconciliationTargetEntity - Required when excludeReconciled is true. Specifies the target entity type for reconciliation filtering
 * @param options.exactMatch - When true, disables fuzzy/trigram matching - only exact text matches (default: false)
 * @param options.sort - Sort order for results
 * @param options.sort[].field - Field to sort by: "date", "amount", or "relevance"
 * @param options.sort[].order - Sort direction: "asc" or "desc"
 *
 * @returns Promise resolving to search results
 * @returns result.entities - Array of entity types that were found in the results
 * @returns result.results - Array of matching entities with full data
 * @returns result.results[].ref - Entity reference (entityId, documentId, entityType, schemaType, etc.)
 * @returns result.results[].preview - Quick preview data (date, amount, currency, description)
 * @returns result.results[].data - Full entity data (header data for HEADER entities, line item data for LINE_ITEM entities)
 * @returns result.total - Total number of matching entities (for pagination)
 * @returns result.hasMore - Whether there are more results beyond the current page
 *
 * @example
 * ```ts
 * // Search invoices with text query and filters
 * const results = await searchByEntity({
 *   query: "serrano",
 *   orgId: "org_123",
 *   limit: 20,
 *   filters: {
 *     preview: {
 *       date: { gte: "2024-01-01", lte: "2024-12-31" },
 *       currency: "USD",
 *       amount: { gte: 100 }
 *     },
 *     entity: {
 *       schemaType: ["INVOICE_header", "RECEIPT_header"]
 *     }
 *   },
 *   where: [
 *     { schemaType: "INVOICE_header", field: "invoiceNumber", op: "contains", value: "INV-2024" }
 *   ],
 *   sort: [{ field: "date", order: "desc" }]
 * });
 *
 * // Retrieve specific entities by ID
 * const entityResults = await searchByEntity({
 *   query: "",
 *   orgId: "org_123",
 *   filters: {
 *     entity: { entityId: ["abc123", "def456"] }
 *   }
 * });
 *
 * // Find all invoice line items where ANY item has amount > 100
 * const lineItemResults = await searchByEntity({
 *   query: "",
 *   orgId: "org_123",
 *   where: [
 *     { schemaType: "INVOICE_items", field: "amount", op: ">", value: 100 }
 *   ]
 * });
 * ```
 */
export async function searchByEntity(
  options: SearchByEntityOptions
): Promise<EntityResponseList> {
  const { query, ...rest } = options;
  const response = await searchByEntityMultiQuery({
    queries: [query],
    ...rest,

  });

  return {
    results: response.results,
    total: response.total,
    hasMore: response.hasMore,
  };
}
