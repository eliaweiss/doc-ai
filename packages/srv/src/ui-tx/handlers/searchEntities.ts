import {
  searchByEntity
} from "@zdocs/db-schema";
import type { EntityResponseList, SearchByEntityOptions } from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";


/**
 * Search for entities with a single query string
 *
 * Designed for AI agents to run complex queries. Supports searching across a multiple entity types
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
 * @param context - UI Tx context
 * @param context.orgId - Organization ID
 * @param context.authMethod - Authentication method
 *
 * @param options - Search configuration options
 * @param options.query - Single search query string. Results matching the query will be returned
 * @param options.limit - Maximum number of results to return (default: 50)
 * @param options.offset - Number of results to skip for pagination (default: 0)
 * @param options.filters - Structured filters for common search fields
 * @param options.filters.date - Date range filter (YYYY-MM-DD format)
 * @param options.filters.date.gte - Start date (inclusive)
 * @param options.filters.date.lte - End date (inclusive)
 * @param options.filters.schemaType - Filter by schema type(s) (e.g., "INVOICE_header", "BANK_STATEMENT_transactions")
 * @param options.filters.folderId - Filter by document folder ID(s)
 * @param options.filters.amount - Amount range filter
 * @param options.filters.amount.gte - Minimum amount (inclusive)
 * @param options.filters.amount.lte - Maximum amount (inclusive)
 * @param options.filters.currency - Filter by currency code(s) (e.g., "USD", "EUR")
 * @param options.filters.isDataset - Filter by dataset flag (true/false)
 * @param options.excludeReconciled - When true, excludes entities that are already reconciled
 * @param options.reconciliationTargetEntity - Required when excludeReconciled is true. Specifies the target entity type for reconciliation filtering
 * @param options.exactMatch - When true, disables fuzzy/trigram matching - only exact text matches (default: true)
 * @param options.where - Optional structured where clauses (ANDed with queries). Each clause filters by a specific field
 * @param options.where[].field - Field name to filter on (must be allowlisted: entityId, documentId, entityType, docType, schemaType, collectionKey, amount, currency, description, isDataset)
 * @param options.where[].op - Comparison operator: "=", "in", ">", ">=", "<", "<=", or "contains"
 * @param options.where[].value - Value to compare against (type depends on field and operator)
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
 * const results = await searchByEntityMultiQuery({
 *   query: "serrano",
 *   limit: 20,
 *   filters: {
 *     date: { gte: "2024-01-01", lte: "2024-12-31" },
 *     currency: "USD",
 *     amount: { gte: 100 }
 *   },
 *   where: [
 *     { field: "docType", op: "in", value: ["INVOICE", "RECEIPT"] }
 *   ],
 *   sort: [{ field: "date", order: "desc" }]
 * });
 * ```
 */
export async function handleSearchEntities(
  context: UiTxContext,
  params: Omit<SearchByEntityOptions, "orgId">
): Promise<EntityResponseList> {
  const { orgId } = context;

  if (params.exactMatch === undefined) {
    params.exactMatch = true;
  }


  // Execute search using multi-query
  const searchResult = await searchByEntity({
    orgId,
    ...params
  });



  return {
    total: searchResult.total,
    results: searchResult.results,
    hasMore: searchResult.hasMore,
  };
}
