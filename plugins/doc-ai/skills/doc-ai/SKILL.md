---
name: doc-ai
description: How to use the doc-ai MCP server (tools get_status, list_searchable_entities, search_entities, aggregate, list_documents, get_document, update_entity_fields, find_documents_in_folder, import_photos, create_mini_app and the rest). Use when the user asks about their documents, invoices, receipts, bank statements, transactions, vendors or spending; wants totals, lists or corrections of extracted values; wants to import receipt photos from a folder; wants a new document type; or wants a mini app built over their doc-ai data.
---

# Using the doc-ai MCP server

doc-ai is a local, single-user server that watches a folder, classifies documents (invoices, receipts, bank statements, …) and extracts their fields with an LLM. Its MCP server is at `http://localhost:4310/mcp` (stateless Streamable HTTP, no auth, localhost only). Every tool returns pretty-printed JSON as text; failures come back as tool errors with a message.

Tool names below are the bare names. In Claude Code they appear prefixed, e.g. `mcp__doc-ai__search_entities` or `mcp__plugin_doc-ai_doc-ai__search_entities`.

## If the tools are missing or fail to connect

The server is not running. Tell the user to start it from the doc-ai checkout:

```bash
npm start
```

(`npm run dev` for watch mode.) Then `/mcp` to reconnect. Don't guess answers about their documents without the tools.

## Data model in one paragraph

Search and aggregation work on **entities**, not documents. Each document yields one **header** entity (ID = document ID) and one **line-item** entity per row of each line-item collection (ID = `documentId_collectionKey_index`). Each entity has a **schemaType**: `<DOCTYPE>_header` or `<DOCTYPE>_<collectionKey>`, e.g. `INVOICE_header`, `INVOICE_lineItems`, `BANK_STATEMENT_transactions`. A header's searchable text includes its line items' text, so a product-name search also hits the invoice header.

## Start here

1. `get_status` when the user asks about doc-ai itself, or when results look empty: it shows document counts per extraction status (pending / failed / done) and the queue. Documents still processing are not searchable yet.
2. `list_searchable_entities` **before your first `search_entities`** in a conversation. It lists the schemaTypes that actually exist and their field names. Use those exact names in `where` clauses and `update_entity_fields`; don't invent field names.

## Picking the tool

| User wants | Use |
|---|---|
| Find things by text ("toner", a vendor, an invoice number) | `search_entities` |
| Filter by a schema field ("invoices from vendor X over 500") | `search_entities` with `where` + `filters.entity.schemaType` |
| A plain list of documents by type / folder / date / amount | `list_documents` |
| Everything about one document | `get_document` |
| Totals, counts, averages | `aggregate` (see its limits below) |
| Fix an extracted value | `get_document` or `get_entity`, then `update_entity_fields` |
| Re-run extraction (after a schema change or a bad extraction) | `reprocess_document` |
| See or add document types | `list_document_types`, `get_document_type`, `create_document_type` |
| See folders, or organize documents into folders | `list_folders`, then `create_folder`, `rename_folder`, `move_folder`, `move_documents`, `delete_folder` |
| Import receipt photos from a folder | `find_documents_in_folder` → `import_photos` |
| Build a small app over the data | `get_mini_app_guide` first, then `create_mini_app` / `update_mini_app` |

## search_entities

The tool description carries the full parameter guide; read it. The essentials:

- `query: ""` matches everything, so you can search by filters and `where` alone.
- Matching is fuzzy by default (full-text, trigram similarity, substring). Set `exactMatch: true` for identifiers like invoice numbers.
- Narrow by kind with `filters.entity.schemaType` (e.g. `"INVOICE_header"`) or `filters.entity.entityType` (`"HEADER"` / `"LINE_ITEM"`). Without it, a query returns headers *and* their line items, which is often noise.
- Quick filters on indexed columns: `filters.preview.date` (`{gte, lte}`, `YYYY-MM-DD`), `filters.preview.amount`, `filters.preview.currency`.
- `where: [{ schemaType, field, op, value }]` filters on schema fields, `op` in `= in > >= < <= contains`. `schemaType` must match the field's schema.
- `sort: [{ field: "date" | "amount" | "relevance", order }]`, `limit` (max 500), `offset` for paging. If you get exactly `limit` results, there may be more.

Example, invoices from a vendor in 2025:

```json
{
  "query": "",
  "filters": {
    "entity": { "schemaType": "INVOICE_header" },
    "preview": { "date": { "gte": "2025-01-01", "lte": "2025-12-31" } }
  },
  "where": [{ "schemaType": "INVOICE_header", "field": "vendorName", "op": "contains", "value": "Acme" }],
  "sort": [{ "field": "date", "order": "desc" }],
  "limit": 100
}
```

(Check the real field name with `list_searchable_entities`; `vendorName` is illustrative.)

## aggregate: know its limits

`aggregate` runs over the search index columns only, and **silently ignores** anything it doesn't allow:

- `metrics`: `count`, or `sum` / `avg` with `field: "amount"` (the only numeric field). Each needs an `as` name.
- `groupBy`: `docType`, `entityType`, `schemaType`, `collectionKey`, `currency`, `isDataset`, plus the time buckets `date`, `month`, `year`.
- `where` (no `schemaType` key here): `entityId`, `documentId`, `entityType`, `docType`, `schemaType`, `collectionKey`, `date`, `amount`, `currency`, `description`, `isDataset`.
- `dateFrom` / `dateTo` as `YYYY-MM-DD`. Always pass `from: "entities"` (`"documents"` returns no rows).

Rules that matter:

- **Always restrict to one schemaType** (e.g. `where: [{ field: "schemaType", op: "=", value: "INVOICE_header" }]`). Otherwise headers and their line items are both summed and totals are double counted.
- **Group by currency** (or filter to one) whenever you sum money; never add amounts in different currencies.
- Grouping by a schema field such as vendor or category is **not** supported. For "spend per vendor", fetch the headers with `search_entities` (paging until done) and group them yourself, and say how many documents the total covers.

Example, monthly invoice spend in 2025:

```json
{
  "from": "entities",
  "metrics": [{ "op": "sum", "field": "amount", "as": "total" }, { "op": "count", "as": "n" }],
  "groupBy": ["month", "currency"],
  "where": [{ "field": "schemaType", "op": "=", "value": "INVOICE_header" }],
  "dateFrom": "2025-01-01",
  "dateTo": "2025-12-31"
}
```

## Correcting data

1. Get the current values (`get_document` for the whole document, `get_entity` for one header or line item).
2. Confirm the change with the user if it's not exactly what they said.
3. `update_entity_fields` with `entityId` and only the fields that change. Field names are validated against the schema; the document is re-indexed, so later searches see the new value.

Use `reprocess_document` only when extraction should be redone from the file; extraction runs again and replaces the extracted values, so manual corrections can be lost.

## Document types

Call `get_document_type` on a system type (e.g. `INVOICE`) to copy the exact field-definition format before `create_document_type`. Type names are upper snake case. `code` formula fields are rejected. A new type only affects documents classified after it exists; reprocess older documents if they should move to it.

## Folders

doc-ai folders mirror the watch folder on disk: the root folder is the watch folder itself and every other folder is a subdirectory. The folder tools keep both sides in step, so creating, renaming or moving a folder changes the directory too, and moved documents' files move with them.

- Start with `list_folders`: it gives each folder's `id`, full `path` (e.g. `"Documents/Receipts/2025"`) and `documentCount`. All other folder tools take ids, never paths or names.
- `create_folder` takes `name` and an optional `parentId` (default: the root). A sibling with the same name is rejected. For a nested path, create each level in turn.
- `rename_folder` (`folderId`, `name`) and `move_folder` (`folderId`, optional `parentId`, default the root) carry subfolders and documents along. A folder can't be moved into its own subtree; the root can't be renamed or moved.
- `move_documents` takes `documentIds` (up to 500) and a target `folderId`. It moves what it can and reports `moved` and `failed` per document; report failures to the user. Find document ids with `list_documents` (filter by `folderId`) or `search_entities`.
- `delete_folder` only deletes an **empty** folder (no documents, no subfolders); otherwise it errors with the counts and deletes nothing. The directory goes to the doc-ai trash. To remove a folder with contents, move the documents out (and delete or move subfolders) first, after confirming with the user where they should go. There is no tool that deletes documents.
- Moving many documents or restructuring several folders changes the user's files on disk: confirm the plan with the user before doing it, then show the result with `list_folders`.
- Right after a change, the watcher may briefly show a stale folder (for example a just-deleted folder for about 5 seconds). If `list_folders` looks off immediately after a change, check again before acting on it.

## Importing photos from a folder

1. `find_documents_in_folder` with an absolute folder path (`~` is expanded). It scans with an on-device model for up to 45 s and returns what it found, or a `scanId` if still running; then poll `get_folder_scan`.
2. Hosts with MCP Apps show a picker where the user selects photos and imports them; nothing more to do.
3. Otherwise, show the user what was found (count, file names) and ask which to import, then call `import_photos` with the absolute `paths` and an optional `folderName` (created if missing). Content already in doc-ai is skipped. The source folder is never modified.

## Mini apps

Mini apps are single-file HTML apps that run inside the doc-ai web UI and read data through the uiTx SDK.

1. `get_mini_app_guide` first, every time: it has the requirements, the SDK reference and the edit format. Follow it over anything you remember.
2. Learn the real data shape with `list_searchable_entities` and a sample `search_entities` call before writing queries in the app.
3. `create_mini_app` with `name`, `code`, and optionally `description`, `icon` (Lucide name), `color` (hex). Heed warnings such as a missing SDK script tag.
4. For changes, `get_mini_app` then `update_mini_app` with anchor-based `edits` (`replace`, `insert_before`, `insert_after`, `delete`) rather than resending the whole code. If any edit fails, nothing is saved: re-read the code and retry.
5. Give the user the app URL from the result (also in `list_mini_apps`).

There's no MCP tool to delete a mini app; the user can delete it in the web UI.

## Answering well

- Quote amounts with their currency and say which date range and document types they cover.
- When a result set was capped by `limit`, say so or page through it.
- If counts look low, check `get_status` for documents still pending or failed before concluding.
- Link to documents by ID so the user can find them in the web UI (`http://localhost:4310`).
