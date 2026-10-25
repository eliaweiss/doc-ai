# MCP server

doc-ai exposes its data to AI assistants through the Model Context Protocol at `http://localhost:4310/mcp`.

## Transport

- **Streamable HTTP, stateless**, with JSON responses. Every HTTP request gets a fresh MCP server and transport, which are closed once the response is built (`handleMcpRequest` in [apps/server/src/mcp.ts](../apps/server/src/mcp.ts)). No session state is kept between calls.
- No authentication: the server only listens on `127.0.0.1`.
- Claude Desktop connects through the `mcp-remote` bridge; clients with native remote-HTTP support use the URL directly. See [Getting started](getting-started.md#connecting-an-mcp-client).

## Claude Code plugin and skill

The repository root is a Claude Code plugin marketplace ([.claude-plugin/marketplace.json](../.claude-plugin/marketplace.json)) with one plugin, [plugins/doc-ai](../plugins/doc-ai):

- [.mcp.json](../plugins/doc-ai/.mcp.json) registers the MCP server (`DOC_AI_MCP_URL`, default `http://localhost:4310/mcp`).
- [skills/doc-ai/SKILL.md](../plugins/doc-ai/skills/doc-ai/SKILL.md) is the usage guide Claude loads when a request is about the user's documents: which tool to pick, search examples, `aggregate` with index and schema fields and its defaults, the correction, reconciliation and import flows, and mini apps.

Install with `/plugin marketplace add eliaweiss/doc-ai` then `/plugin install doc-ai@doc-ai`. Keep the skill in step with this page when tools change; `claude plugin validate .` checks the manifests.

## MCP tools and the mini-app SDK

The MCP tools cover what a mini app can do through the uiTx SDK, and call the same handlers. So a one-off change ("link these payments to their invoices", "fix the totals on these receipts", "move last year's statements to an archive folder") can be asked for in chat, with the model deciding case by case, instead of being built as an app.

| uiTx SDK method | MCP tool |
|---|---|
| `getSession` | `get_status` |
| `searchEntities`, `getEntity`, `listDocuments`, `aggregate` | `search_entities`, `get_entity`, `list_documents`, `aggregate` |
| `updateEntityFields` | `update_entity_fields` |
| `listReconciliationLinks`, `traceReconciliation`, `createReconciliationLink`, `deleteReconciliationLink` | `list_reconciliation_links`, `trace_reconciliation`, `create_reconciliation_link` (takes entity IDs instead of full refs), `delete_reconciliation_link` |
| `listFolders`, `moveDocuments`, `renameFolder`, `moveFolder`, `deleteFolder` | `list_folders`, `move_documents`, `rename_folder`, `move_folder`, `delete_folder` |
| `ui.toast`, `ui.confirm`, `ui.open*`, `ui.uploadToFolder` | None; these drive the web UI |

The MCP server also has tools the SDK doesn't: `create_folder`, document types, `reprocess_document`, Import from folder and the mini-app tools. Unlike an app's `ui.confirm`, MCP writes happen as soon as the tool is called; the skill tells the model to show the user what it will change first. For bulk writes, the `dryRun` and `expectedCount` pair enforces that step ([Bulk changes](#bulk-changes)). There's no tool that runs arbitrary uiTx code. Filter-based bulk tools cover the cases where the same change applies to many records; changes that differ per record are still made one call at a time.

## Results and errors

Every tool returns its result as pretty-printed JSON text. Errors are returned as tool errors (`isError`) with the message, not as protocol failures.

## Tools

### Status and schemas

| Tool | Arguments | What it does | Implementation |
|---|---|---|---|
| `get_status` | none | Watch folder, data folder, provider and model, document counts per extraction status, queue stats. | `getStatus` in [services.ts](../apps/server/src/services.ts) |
| `list_document_types` | none | Every document type with its header field names and line-item collection keys. | `listDocumentTypes` in [services.ts](../apps/server/src/services.ts) |
| `get_document_type` | `name` | The full schema of one type (fields, collections, formulas). | `getDocumentType` |
| `create_document_type` | `name`, `displayName`, `description?`, `extractionHint?`, `headerSchema`, `lineItemSchemas?` | Creates a custom type. Rejects duplicates and any `code` fields. | `createDocumentType` |

### Documents

| Tool | Arguments | What it does | Implementation |
|---|---|---|---|
| `list_documents` | `docType?`, `folderId?`, `date?` (range), `amount?` (range), `currency?`, `orderBy?` (`documentDate`, `createdAt` or `totalAmount`, asc/desc), `limit?` (max 500), `offset?` | Lists documents with filters. | [listDocuments.ts](../packages/srv/src/ui-tx/handlers/listDocuments.ts) |
| `get_document` | `documentId` | File info, status, extracted header data, line items and notifications. | `getDocumentDetail` |
| `reprocess_document` | `documentId` | Queues classification and extraction again (for example after a schema change). | `reprocessDocument` |

### Entities (search, aggregation, corrections)

| Tool | Arguments | What it does | Implementation |
|---|---|---|---|
| `list_searchable_entities` | none | Schema types (for example `INVOICE_header`, `BANK_STATEMENT_transactions`) with their fields. Meant to be called before searching. | [getSearchableEntitiesForOrg.ts](../packages/db-schema/src/queries/search/getSearchableEntitiesForOrg.ts) |
| `search_entities` | `query`, `limit?`, `offset?`, `filters?` (preview and entity filters), `exactMatch?`, `where?`, `sort?` | Searches headers and line items. The tool description includes the full parameter guide written for LLMs. | [searchEntities.ts](../packages/srv/src/ui-tx/handlers/searchEntities.ts) |
| `get_entity` | `entityId` | One header (document ID) or line item (`documentId_collectionKey_index`). | [getEntity.ts](../packages/srv/src/ui-tx/handlers/getEntity.ts) |
| `aggregate` | `from` (`entities`), `metrics` (count/sum/avg with `field` and `as`), `groupBy?`, `where?`, `schemaType?`, `dateFrom?`, `dateTo?`, `limit?` | Totals, counts and averages, optionally grouped. With `schemaType`, fields of that schema (e.g. `vendorName`) can be grouped, filtered and summed. Unknown fields are errors; see [Search and querying](search.md#aggregation) for the defaults. | [aggregate.ts](../packages/srv/src/ui-tx/handlers/aggregate.ts) |
| `update_entity_fields` | `entityId` or `select`, `fields`, `excludeEntityIds?`, `dryRun?`, `expectedCount?` | Corrects extracted values; field names are checked against the schema. With `select`, sets the same `fields` on every match (one schemaType only; see [Bulk changes](#bulk-changes)). | [updateEntityFields.ts](../packages/srv/src/ui-tx/handlers/updateEntityFields.ts) |

Search semantics are described in [Search and querying](search.md).

### Reconciliation links

Registered by [reconciliation/mcp-tools.ts](../apps/server/src/reconciliation/mcp-tools.ts). They wrap the same handlers as the mini-app SDK's reconciliation methods. A link says that money moved from a source entity (for example a bank-statement transaction) to a target (for example the invoice it paid). Either side can be a header or a line item.

| Tool | Arguments | What it does | Implementation |
|---|---|---|---|
| `list_reconciliation_links` | `entityId?`, `schemaType?`, `limit?` | Links touching one entity (either side), links where either side has the given schema type, or all links. | [listReconciliationLinks.ts](../packages/srv/src/ui-tx/handlers/listReconciliationLinks.ts) |
| `trace_reconciliation` | `startEntityId?` and/or `endEntityId?`, `maxDepth?` (default 10), `limit?` (default 50) | Follows links from an entity in both directions and returns the entities (`nodes`) and links (`edges`). With `endEntityId`, `summary.matchingPaths` counts the chains that reach it. | [traceReconciliation.ts](../packages/srv/src/ui-tx/handlers/traceReconciliation.ts) |
| `create_reconciliation_link` | `sourceEntityId`, `targetEntityId`, `amount`, `currency`, `date?` (default: the source's date), `sourceField?`, `targetField?`, `note?` | Creates a manual link. The tool looks up both entities and builds the full references, so the caller passes only IDs. `sourceField`/`targetField` name the amount fields that were matched and must exist on the entity. `note` is saved in the link's metadata. Linking an entity to itself is rejected. | [createReconciliationLink.ts](../packages/srv/src/ui-tx/handlers/createReconciliationLink.ts) |
| `delete_reconciliation_link` | `linkId` | Soft-deletes a link. | [deleteReconciliationLink.ts](../packages/srv/src/ui-tx/handlers/deleteReconciliationLink.ts) |

### Import from folder

Registered by [photo-sort/mcp-tools.ts](../apps/server/src/photo-sort/mcp-tools.ts). See [Import from folder](import-from-folder.md) for the full flow.

| Tool | Arguments | What it does | Visible to |
|---|---|---|---|
| `find_documents_in_folder` | `folder` (absolute, `~` expanded), `includeScreenshots?` | Starts a scan of the folder with the on-device Eye model, waits up to 45 seconds, and returns the receipts and documents found (as text, plus structured content for the picker). | Model |
| `get_folder_scan` | `scanId`, `includeScreenshots?` | Progress or result of a scan that was still running. | Model and picker |
| `import_photos` | `paths` (absolute), `folderId?` or `folderName?` | Copies the photos into the watch folder, puts them in a doc-ai folder (found or created by name, else the root) and queues them. Skips content already in doc-ai. | Model and picker |
| `get_photo_thumbnails` | `scanId?`, `paths` (max 24) | Base64 JPEG thumbnails, only for paths returned by a scan. | Picker only |

### Folders

Registered by [folders/mcp-tools.ts](../apps/server/src/folders/mcp-tools.ts). Changes go through the same HTTP routes as the UI (called in-process with `app.request`), so the folder ↔ directory sync in [folder-routes.ts](../apps/server/src/folder-routes.ts) applies: directories in the watch folder are created, renamed and moved with their folders, and moved documents' files follow them.

| Tool | Arguments | What it does |
|---|---|---|
| `list_folders` | none | Every folder with its ID, full path (`Documents/Receipts/2025`), parent and document count. |
| `create_folder` | `name`, `parentId?` (default: root) | Creates a folder and its directory. Rejects a duplicate sibling name. |
| `rename_folder` | `folderId`, `name` | Renames the folder and its directory; documents are repointed. Not the root. |
| `move_folder` | `folderId`, `parentId?` (default: root) | Moves a folder with its subtree. Rejects moving into itself; not the root. |
| `delete_folder` | `folderId` | Deletes an empty folder (no documents, no subfolders); its directory goes to the doc-ai trash. Errors with the counts otherwise. |
| `move_documents` | `documentIds` (max 500) or `select`, `folderId`, `excludeDocumentIds?`, `dryRun?`, `expectedCount?` | Moves documents and their files; returns `moved` and per-document `failed`. With `select`, moves every matching document (see [Bulk changes](#bulk-changes)). |

Unlike the UI's folder delete, which also deletes the folder's documents and subfolders, `delete_folder` never deletes documents.

### Mini apps

Registered by [mini-apps/mcp-tools.ts](../apps/server/src/mini-apps/mcp-tools.ts). They take the place of zdocs' AI builder: the MCP client writes the code. See [Mini apps](mini-apps.md).

| Tool | Arguments | What it does |
|---|---|---|
| `get_mini_app_guide` | | Requirements, the uiTx SDK reference (zdocs' builder docs, with doc-ai notes) and the edit format. Clients should read it before writing code. |
| `list_mini_apps` | `includeArchived?` | Every app with its URL in the web UI; archived apps only with `includeArchived`. |
| `get_mini_app` | `id` | One app with its full code. |
| `create_mini_app` | `name`, `code`, `description?`, `icon?` (Lucide name), `color?` (hex) | Validates the HTML, inline JS and CSS, then saves. Warns if the SDK script tag is missing. |
| `update_mini_app` | `id`, `edits?` or `code?`, `name?`, `description?`, `icon?`, `color?`, `archived?` | Applies zdocs' anchor-based edits (`replace`, `insert_before`, `insert_after`, `delete`) or replaces the whole code. If any edit fails or the result doesn't validate, nothing is saved. `archived: true` archives the app, `false` restores it. |

There's no delete tool; apps can be deleted through the HTTP API.

### Bulk changes

`move_documents` and `update_entity_fields` take `select` in place of IDs, so a change to many records needs a few small calls and no ID lists in the conversation. The shared code is in [selection.ts](../apps/server/src/selection.ts).

- `select` has the same `query`, `filters` and `where` as `search_entities`, without paging. The server pages through the search itself. An empty selection is refused, and so is one matching more than 2000 entities. Matched line items stand for their documents when moving.
- `dryRun: true` changes nothing. It returns `entityCount`, `documentCount`, `schemaTypes` and up to 8 samples, each with date, amount, description and the fields `where` filtered on.
- A real run with `select` must pass `expectedCount`: the dry run's `documentCount` for `move_documents`, or its `entityCount` for `update_entity_fields`. If the selection matches a different number by then, nothing changes. This makes the dry run, and the confirmation with the user that goes with it, a required step.
- `excludeDocumentIds` / `excludeEntityIds` drop records the dry run showed shouldn't be included.
- `update_entity_fields` with `select` refuses a selection that spans several schemaTypes. It stops before changing anything if the first update fails (for example, an unknown field).

The intended flow is to call `aggregate` with `groupBy` on the identifying field to see the distinct values, then have the model decide which belong together, dry-run, confirm with the user and run. On a real install with 221 receipts, the distinct merchant list was 6 KB, against 266 KB for searching every receipt. The dry run for one shop's three spellings was under 2 KB.

### MCP Apps picker

`find_documents_in_folder` declares a UI resource, `ui://doc-ai/import-picker.html`, using the [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) extension. Hosts that support MCP Apps render it inline next to the tool result: a grid of thumbnails with everything found pre-selected, select/unselect all, a target-folder picker and an Import button. The page is [picker.html](../apps/server/src/photo-sort/picker.html); at serve time the MCP Apps client bundle is inlined into it, because hosts sandbox the page and it can't load scripts from elsewhere. Hosts without MCP Apps get the same information as text, and the model can call `import_photos` itself.

## Example questions

- "What's the status of doc-ai?" → `get_status`
- "What did I spend on toner?" → `list_searchable_entities`, then `search_entities` with query "toner"
- "Invoice spend per month in 2025" → `aggregate` with `schemaType` `INVOICE_header`, a sum of `amount`, `groupBy` `month` and a date range
- "Total spend per vendor in 2025" → `aggregate` with `schemaType` `INVOICE_header`, a sum of `total`, `groupBy` `vendorName` and `currency`, and a date range
- "The total on invoice X should be 1,240.50" → `get_document`, then `update_entity_fields`
- "Add a document type for utility bills" → `get_document_type` on `INVOICE`, then `create_document_type`
- "Which bank transaction paid invoice X?" → `list_reconciliation_links` with the invoice's `entityId`, or `trace_reconciliation` for longer chains
- "Match March's card payments to the open invoices" → `search_entities` on both sides, then `create_reconciliation_link` for each pair the user approves
- "Move my receipts from Mercado Dona Helena to a Groceries folder" → `aggregate` grouped by `merchantName` to see its spellings, `create_folder`, `move_documents` with `select` and `dryRun`, then again with `expectedCount`
- "Put all 2025 receipts in a Receipts/2025 folder" → `list_folders`, `create_folder` (twice, for each level), `search_entities` or `list_documents` for the IDs, then `move_documents`
- "Find the receipts in ~/Pictures/2025 and import them" → `find_documents_in_folder`, then the picker or `import_photos`
- "Make me an app that shows monthly spend per category" → `get_mini_app_guide`, `list_searchable_entities` and `search_entities` to learn the data, then `create_mini_app`
