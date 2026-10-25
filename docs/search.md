# Search and querying

## Entities

Search works on **entities**, not whole documents. Every indexed document produces:

- one **header** entity, with ID equal to the document ID, and
- one **line-item** entity per row of every line-item collection, with ID `documentId_collectionKey_index`.

Each entity has a **schema type**: `<DOCTYPE>_header` for headers and `<DOCTYPE>_<collectionKey>` for line items, for example `INVOICE_header`, `INVOICE_lineItems` or `BANK_STATEMENT_transactions`. `list_searchable_entities` (MCP) and the search page's entity selector list the schema types that exist, with their fields ([getSearchableEntitiesForOrg.ts](../packages/db-schema/src/queries/search/getSearchableEntitiesForOrg.ts)).

## The index

`indexDocument` in [queries/documents.ts](../packages/db-schema/src/queries/documents.ts) runs at the end of extraction (and after edits). It deletes the document's old rows in `search_index` and writes new ones ([schemas/search.ts](../packages/db-schema/src/schemas/search.ts)):

- `content`: plain text made from the entity's **searchable** fields. A header's content also includes the text of all its line items, so searching for a product name finds the invoice that contains it.
- Quick-view columns: entity type, schema type, doc type, collection key, date, description, amount, currency, dataset flag, duplicate flag.

The index stores only searchable text and preview columns. Other values (quantities, extra fields) are read from `documents` and `document_data` at query time, so results always reflect the latest edits.

Two GIN indexes back text search: an English full-text (`tsvector`) index and a trigram index (`pg_trgm`).

## Text matching

[buildSearchConditionForQuery.ts](../packages/db-schema/src/queries/search/buildSearchConditionForQuery.ts) builds the match condition for a query string:

- **Fuzzy (default)**: an entity matches if any of these is true: English full-text search (web-search syntax), trigram word similarity above 0.3 (tolerates typos), or a case-insensitive substring match.
- **Exact match** (`exactMatch: true`): case-insensitive substring only.
- An empty query matches everything, so results are driven by filters alone.

## Filters, where clauses and sorting

`searchByEntity` ([searchByEntity.ts](../packages/db-schema/src/queries/search/searchByEntity.ts)) and its helpers in [search-sub-functions](../packages/db-schema/src/queries/search/search-sub-functions) support:

- **Preview filters**: date range, amount range, currency (on the indexed quick-view columns).
- **Entity filters**: entity IDs, document IDs, entity type (header or line item), doc type, schema type, collection key, folder, dataset flag.
- **Where clauses** on schema fields: `{ schemaType, field, op, value }` with operators `=`, `in`, `>`, `>=`, `<`, `<=`, `contains`, evaluated against the JSON data for that schema type ([applySchemaSpecificFilters.ts](../packages/db-schema/src/queries/search/search-sub-functions/applySchemaSpecificFilters.ts)).
- **Reconciliation filter**: exclude already-reconciled entities (meaningful once reconciliation lands).
- **Sorting** by date, amount or relevance, and **pagination** with limit/offset.

A multi-query variant ([searchByEntityMultiQuery.ts](../packages/db-schema/src/queries/search/searchByEntityMultiQuery.ts)) runs several queries at once; the search page uses it for result tabs.

## Aggregation

[aggregateEntitiesForOrg.ts](../packages/db-schema/src/queries/search/aggregateEntitiesForOrg.ts) computes `count`, `sum` and `avg` metrics over entities with optional `groupBy` fields, where filters and a date range, for questions like "total spend per vendor" or "sum per schema type". It's exposed as the `aggregate` MCP tool through [handlers/aggregate.ts](../packages/srv/src/ui-tx/handlers/aggregate.ts). Only entity aggregation is implemented; document-level aggregation is a TODO.

## Saved queries

The search page can save, rename and delete queries ([queries/search](../packages/db-schema/src/queries/search), routes under [zdocs-api/org/[orgId]/saved-queries](../apps/server/src/zdocs-api/org/[orgId]/saved-queries)).

## Agent handlers ("uiTx")

zdocs' in-app AI agent called a small set of "uiTx" handlers. doc-ai reuses them as the core of its MCP tools ([packages/srv/src/ui-tx/handlers](../packages/srv/src/ui-tx/handlers)):

| Handler | Purpose |
|---|---|
| [searchEntities.ts](../packages/srv/src/ui-tx/handlers/searchEntities.ts) | Search with the options above. Its parameter documentation, written for an LLM, is in [ui-tx-searchEntities-prompt.ts](../packages/srv/src/chat/ui-tx-prompt-docs/ui-tx-searchEntities-prompt.ts) and is embedded in the MCP tool description. |
| [getEntity.ts](../packages/srv/src/ui-tx/handlers/getEntity.ts) | One header or line item with its schema. (A TODO in the file notes that line items should be read from the search index.) |
| [aggregate.ts](../packages/srv/src/ui-tx/handlers/aggregate.ts) | Aggregation. |
| [listDocuments.ts](../packages/srv/src/ui-tx/handlers/listDocuments.ts) | Documents with filters on type, folder, date, amount, currency, and ordering. |
| [updateEntityFields.ts](../packages/srv/src/ui-tx/handlers/updateEntityFields.ts) | Correct values on a header or line item; field names are validated against the schema and the document is re-indexed. |

All handlers take a context with the org ID; doc-ai always passes the local org.
