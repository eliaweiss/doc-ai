import { zdocsDb } from "../../db";
import { searchIndexTbl } from "../../schemas/search";
import { documentTbl, documentDataTbl } from "../../schemas/documents";
import { institutionsTbl } from "../../schemas/institutions";
import {
  eq,
  and,
  sql,
  desc,
  asc,
} from "drizzle-orm";
import {
  type MultiEntitySearchResponse,
  type SearchByEntityMultiQueryOptions,
} from "@zdocs/types";
import { buildMultiQuerySearchCondition } from "./buildMultiQuerySearchCondition";
import { getSearchableEntitiesForOrg } from "./getSearchableEntitiesForOrg";
import { applyPreviewFilters } from "./search-sub-functions/applyPreviewFilters";
import { applyEntityFilters } from "./search-sub-functions/applyEntityFilters";
import { applySchemaSpecificFilters } from "./search-sub-functions/applySchemaSpecificFilters";
import { buildDocumentJoinConditions } from "./search-sub-functions/buildDocumentJoinConditions";
import { applyReconciliationFilter } from "./search-sub-functions/applyReconciliationFilter";
import { processSearchResults } from "./search-sub-functions/processSearchResults";

/**
 * Search for entities across multiple entity types with multiple queries (ORed together)
 *
 * Designed for AI agents to run complex queries. Supports searching across MULTIPLE entity types
 * simultaneously, with results matching ANY of the provided queries being returned.
 *
 * Features:
 * - Multi-query search: Multiple search queries are ORed together
 * - Multi-entity support: Can search across different entity types in a single call
 * - Preview filters: Filter on indexed preview data (date, amount, currency)
 * - Entity filters: Filter on entity metadata (entityId, schemaType, docType, etc.)
 * - Schema-specific field filtering: Filter on JSONB fields from headerData or lineItems
 * - Reconciliation filtering: Can exclude already-reconciled entities
 * - Pagination: Supports limit/offset for result pagination
 * - Sorting: Supports sorting by date, amount, or relevance
 *
 * @param options - Search configuration options
 * @param options.queries - Array of search query strings. Results matching ANY query will be returned (ORed together)
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
 * const results = await searchByEntityMultiQuery({
 *   queries: ["serrano", "walmart"],
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
 * const entityResults = await searchByEntityMultiQuery({
 *   queries: [],
 *   orgId: "org_123",
 *   filters: {
 *     entity: { entityId: ["abc123", "def456"] }
 *   }
 * });
 *
 * // Find all invoice line items where ANY item has amount > 100
 * const lineItemResults = await searchByEntityMultiQuery({
 *   queries: [],
 *   orgId: "org_123",
 *   where: [
 *     { schemaType: "INVOICE_items", field: "amount", op: ">", value: 100 }
 *   ]
 * });
 * ```
 */
export async function searchByEntityMultiQuery(
  options: SearchByEntityMultiQueryOptions
): Promise<MultiEntitySearchResponse> {
  const {
    queries,
    orgId,
    limit = 50,
    offset = 0,
    filters,
    excludeReconciled,
    reconciliationTargetEntity,
    exactMatch = false,
    where,
    sort,
  } = options;

  const searchableEntities = await getSearchableEntitiesForOrg(orgId);

  // Base conditions: orgId + entity type filter
  const conditions = [eq(searchIndexTbl.orgId, orgId)];

  // Build combined search condition for all queries (ORed together)
  const searchCondition = buildMultiQuerySearchCondition(queries, exactMatch);
  if (searchCondition) {
    conditions.push(searchCondition);
  }

  // Apply preview filters (date, amount, currency)
  applyPreviewFilters(filters, conditions);

  // Apply entity filters (entityId, schemaType, docType, etc.)
  applyEntityFilters(filters, conditions);

  // Apply schema-specific JSONB field filters
  const { needsDocumentDataJoin, documentDataConditions } =
    applySchemaSpecificFilters(where, conditions);

  // Build document join conditions (date, folderId)
  const joinCondition = buildDocumentJoinConditions(filters);

  // Apply reconciliation filter
  applyReconciliationFilter(
    excludeReconciled,
    reconciliationTargetEntity,
    orgId,
    conditions
  );

  // Build document_data join condition if needed for schema-specific filtering
  const documentDataJoinCondition = needsDocumentDataJoin
    ? and(...documentDataConditions)
    : undefined;

  // Build count query with optional document_data join
  let countQuery = zdocsDb
    .select({ count: sql<number>`count(*)::int` })
    .from(searchIndexTbl)
    .innerJoin(documentTbl, joinCondition!);

  if (needsDocumentDataJoin && documentDataJoinCondition) {
    countQuery = countQuery.innerJoin(
      documentDataTbl,
      documentDataJoinCondition
    ) as typeof countQuery;
  }

  const countResult = await countQuery.where(and(...conditions)).execute();

  const total = countResult[0]?.count ?? 0;

  // Build main query with optional document_data join
  let mainQuery = zdocsDb
    .select({
      documentId: searchIndexTbl.documentId,
      entityId: searchIndexTbl.entityId,
      entityType: searchIndexTbl.entityType,
      content: searchIndexTbl.content,
      collectionKey: searchIndexTbl.collectionKey,
      schemaType: searchIndexTbl.schemaType,
      documentDate: documentTbl.documentDate,
      documentFileName: documentTbl.fileName,
      documentInstitutionName: institutionsTbl.name,
      documentCurrency: documentTbl.currency,
      documentFolderId: documentTbl.folderId,
      date: searchIndexTbl.date,
      amount: searchIndexTbl.amount,
      currency: searchIndexTbl.currency,
      description: searchIndexTbl.description,
      docType: searchIndexTbl.docType,
      isDataset: searchIndexTbl.isDataset,
    })
    .from(searchIndexTbl)
    .innerJoin(documentTbl, joinCondition!)
    .leftJoin(institutionsTbl, eq(documentTbl.institutionId, institutionsTbl.id));

  if (needsDocumentDataJoin && documentDataJoinCondition) {
    mainQuery = mainQuery.innerJoin(
      documentDataTbl,
      documentDataJoinCondition
    ) as typeof mainQuery;
  }

  const indexResults = await mainQuery
    .where(and(...conditions))
    .orderBy(
      ...(sort && sort.length > 0
        ? sort.map((s) => {
          if (s.field === "date") {
            return s.order === "asc"
              ? asc(searchIndexTbl.date)
              : desc(searchIndexTbl.date);
          } else if (s.field === "amount") {
            return s.order === "asc"
              ? asc(searchIndexTbl.amount)
              : desc(searchIndexTbl.amount);
          } else {
            // relevance - default to date descending as fallback
            return desc(searchIndexTbl.date);
          }
        })
        : [desc(searchIndexTbl.date)])
    )
    .limit(limit)
    .offset(offset)
    .execute();

  // Process search results (fetch document data and build entity responses)
  const results = await processSearchResults(indexResults);

  // Filter entities to only those found in the results
  const entities = searchableEntities.filter((e) =>
    results.some(
      (r) =>
        r.ref.entityType === e.entityType && r.ref.schemaType === e.schemaType
    )
  );
  return {
    entities,
    results,
    total,
    hasMore: offset + results.length < total,
  };
}
