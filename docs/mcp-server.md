# MCP server

doc-ai exposes its data to AI assistants through the Model Context Protocol at `http://localhost:4310/mcp`.

## Transport

- **Streamable HTTP, stateless**, with JSON responses. Every HTTP request gets a fresh MCP server and transport, which are closed once the response is built (`handleMcpRequest` in [apps/server/src/mcp.ts](../apps/server/src/mcp.ts)). No session state is kept between calls.
- No authentication: the server only listens on `127.0.0.1`.
- Claude Desktop connects through the `mcp-remote` bridge; clients with native remote-HTTP support use the URL directly. See [Getting started](getting-started.md#connecting-an-mcp-client).

## Claude Code plugin and skill

The repository root is a Claude Code plugin marketplace ([.claude-plugin/marketplace.json](../.claude-plugin/marketplace.json)) with one plugin, [plugins/doc-ai](../plugins/doc-ai):

- [.mcp.json](../plugins/doc-ai/.mcp.json) registers the MCP server (`DOC_AI_MCP_URL`, default `http://localhost:4310/mcp`).
- [skills/doc-ai/SKILL.md](../plugins/doc-ai/skills/doc-ai/SKILL.md) is the usage guide Claude loads when a request is about the user's documents: which tool to pick, search examples, the `aggregate` allowlist and double-counting pitfalls, the correction and import flows, and mini apps.

Install with `/plugin marketplace add eliaweiss/doc-ai` then `/plugin install doc-ai@doc-ai`. Keep the skill in step with this page when tools change; `claude plugin validate .` checks the manifests.

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
| `aggregate` | `from` (`entities`), `metrics` (count/sum/avg with `field` and `as`), `groupBy?`, `where?`, `dateFrom?`, `dateTo?`, `limit?` | Totals, counts and averages, optionally grouped. | [aggregate.ts](../packages/srv/src/ui-tx/handlers/aggregate.ts) |
| `update_entity_fields` | `entityId`, `fields` | Corrects extracted values; field names are checked against the schema. | [updateEntityFields.ts](../packages/srv/src/ui-tx/handlers/updateEntityFields.ts) |

Search semantics are described in [Search and querying](search.md).

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
| `move_documents` | `documentIds` (max 500), `folderId` | Moves documents and their files; returns `moved` and per-document `failed`. |

Unlike the UI's folder delete, which also deletes the folder's documents and subfolders, `delete_folder` never deletes documents.

### MCP Apps picker

`find_documents_in_folder` declares a UI resource, `ui://doc-ai/import-picker.html`, using the [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) extension. Hosts that support MCP Apps render it inline next to the tool result: a grid of thumbnails with everything found pre-selected, select/unselect all, a target-folder picker and an Import button. The page is [picker.html](../apps/server/src/photo-sort/picker.html); at serve time the MCP Apps client bundle is inlined into it, because hosts sandbox the page and it can't load scripts from elsewhere. Hosts without MCP Apps get the same information as text, and the model can call `import_photos` itself.

## Example questions

- "What's the status of doc-ai?" → `get_status`
- "What did I spend on toner?" → `list_searchable_entities`, then `search_entities` with query "toner"
- "Invoice spend per month in 2025" → `aggregate` with a sum metric, `groupBy` `month` and `currency`, a `schemaType` filter and a date range
- "Total spend per vendor in 2025" → `search_entities` on the header schema type for that date range, then group by vendor client-side (`aggregate` can only group by index columns such as `docType`, `currency` or `month`)
- "The total on invoice X should be 1,240.50" → `get_document`, then `update_entity_fields`
- "Add a document type for utility bills" → `get_document_type` on `INVOICE`, then `create_document_type`
- "Put all 2025 receipts in a Receipts/2025 folder" → `list_folders`, `create_folder` (twice, for each level), `search_entities` or `list_documents` for the IDs, then `move_documents`
- "Find the receipts in ~/Pictures/2025 and import them" → `find_documents_in_folder`, then the picker or `import_photos`
