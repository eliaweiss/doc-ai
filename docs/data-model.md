# Data model

## The database

doc-ai uses **PGlite**, a WebAssembly build of Postgres that runs inside the Node process ([packages/db-schema/src/db.ts](../packages/db-schema/src/db.ts)). It replaces zdocs' hosted Neon / postgres-js connection; the rest of zdocs' Drizzle query layer runs on it unchanged.

- Stored in `<data folder>/workspaces/<watch folder name>-<hash>/pgdata`: each watch folder has its own database. One instance is open at a time, and only one doc-ai process can use a data folder at a time.
- Extensions: `pg_trgm` (trigram similarity for fuzzy search) and `vector` (enabled for future vector search; not used yet).
- `DOC_AI_DB_IN_MEMORY=1` switches to an in-memory database.
- Schema: Drizzle table definitions in [packages/db-schema/src/schemas](../packages/db-schema/src/schemas), exported from [schemas/index.ts](../packages/db-schema/src/schemas/index.ts).
- Migrations: SQL files in [packages/db-schema/migrations](../packages/db-schema/migrations) (`0000_init`, `0001_quick_access`, `0002_ai_model_settings`), applied on every start by [apps/server/src/db.ts](../apps/server/src/db.ts).

### Org scoping

zdocs is multi-tenant: nearly every query is named `…ForOrg(orgId, …)` and every table has an `org_id`. doc-ai keeps that and uses one fixed organization (`id = "local"`) owned by one user (`id = "local-user"`). They are created at startup by `ensureLocalOrg` in [queries/local.ts](../packages/db-schema/src/queries/local.ts), together with the root folder ("Documents"), the system document types and the default quick-access shortcuts. The organization's time zone defaults to the machine's.

## Tables

### Core

| Table | Schema file | Contents |
|---|---|---|
| `documents` | [documents.ts](../packages/db-schema/src/schemas/documents.ts) | One row per file: folder, `docType`, file name/extension/content type, MD5 `contentHash`, storage location (`s3Bucket`/`s3Key`), page count, extraction status and errors, denormalized description/date/currency, upload-complete flag, `metadata` (doc-ai stores `sourcePath` and, for imports, `importedFrom`), soft-delete timestamp. |
| `document_data` | [documents.ts](../packages/db-schema/src/schemas/documents.ts) | One row per document: `headerData` (JSON), `lineItems` (JSON object of collections), denormalized `totalAmount`, `documentDate`, `dueDate`, `transactionType`, `notifications`, and the schema version used. GIN indexes on the JSON columns. |
| `document_types` | [document-types.ts](../packages/db-schema/src/schemas/document-types.ts) | Schemas; see [Document types](document-types.md). |
| `folders` | [folders.ts](../packages/db-schema/src/schemas/folders.ts) | The virtual folder tree of the drive (parent, root and system flags, colour, document count). |
| `ai_processing_queue` | [ai.ts](../packages/db-schema/src/schemas/ai.ts) | Queue jobs; see [Processing pipeline](processing-pipeline.md#the-queue). |
| `search_index` | [search.ts](../packages/db-schema/src/schemas/search.ts) | One row per searchable entity (header or line item); see [Search](search.md). |
| `notifications` | [notifications.ts](../packages/db-schema/src/schemas/notifications.ts) | Warnings and errors raised by formulas, per document and field, with a status (new, read, …). |

### Supporting

| Table | Schema file | Contents |
|---|---|---|
| `ai_usage_logs` | [ai.ts](../packages/db-schema/src/schemas/ai.ts) | Every model call: action, model, tokens, estimated cost, the entity it was for. |
| `ai_model_settings` | [ai-model-settings.ts](../packages/db-schema/src/schemas/ai-model-settings.ts) | The model chosen per pipeline action on the Settings page (added by doc-ai). |
| `saved_queries` | [search.ts](../packages/db-schema/src/schemas/search.ts) | Saved searches from the search page. |
| `mini_apps`, `mini_apps_history` | [mini-apps.ts](../packages/db-schema/src/schemas/mini-apps.ts), [mini-apps-history.ts](../packages/db-schema/src/schemas/mini-apps-history.ts) | [Mini apps](mini-apps.md) (HTML code, name, icon, colour) and a snapshot per save. The `messages` column holds zdocs builder chats and is unused locally. |
| `quick_access` | [quick-access.ts](../packages/db-schema/src/schemas/quick-access.ts) | The user's app shortcuts in the header bar. |
| `document_metadata` | [document-metadata.ts](../packages/db-schema/src/schemas/document-metadata.ts) | Extra per-document data keyed by type. |
| `institutions` | [institutions.ts](../packages/db-schema/src/schemas/institutions.ts) | Banks, card issuers and other institutions resolved from extracted names. |
| `organizations` | [organizations.ts](../packages/db-schema/src/schemas/organizations.ts) | The single local org (name, base currency, time zone; webhook and email columns unused locally). |
| `users`, `accounts`, `sessions`, `verification_tokens` | [auth.ts](../packages/db-schema/src/schemas/auth.ts) | Kept from zdocs for foreign keys; only the local user exists. |
| `process_locks` | [process-locks.ts](../packages/db-schema/src/schemas/process-locks.ts) | zdocs' cross-process lock; not needed by the single process. |
| `reconciliation_links`, `saved_reconciliation_sessions`, `saved_ledger_trace_sessions` | [reconciliation-links.ts](../packages/db-schema/src/schemas/reconciliation-links.ts) | Reconciliation (matching transactions across documents). Used by the workbench; `saved_ledger_trace_sessions` is not used yet (ledger trace isn't ported). |

### Queries

The query layer lives in [packages/db-schema/src/queries](../packages/db-schema/src/queries): documents and indexing ([documents.ts](../packages/db-schema/src/queries/documents.ts)), document types, folders, queue, notifications, organizations, quick access, AI usage and model settings, search ([queries/search](../packages/db-schema/src/queries/search)), and the doc-ai additions in [local.ts](../packages/db-schema/src/queries/local.ts) (local org bootstrap, lookup by content hash or by path, storage updates). The package entry point [index.ts](../packages/db-schema/src/index.ts) is trimmed to what doc-ai uses.

## Files on disk

Everything doc-ai writes lives in the **data folder** (default `~/.doc-ai`), except files uploaded or imported through the UI, which go into the watch folder.

| Path | Contents |
|---|---|
| `settings.json` | Settings saved from the UI (mode 600; may contain the Gateway key), including the current watch folder. |
| `data-dir.json` | Only in `~/.doc-ai`: pointer to a different data folder chosen on the Settings page. |
| `scans/` | Saved Import-from-folder scans. |
| `workspaces/<name>-<hash>/` | One per watch folder (`<name>` is the folder's name, `<hash>` part of the SHA-1 of its path; `no-watch-folder/` when none is set). Holds the entries below and a `workspace.json` naming the watch folder. |
| `…/pgdata/` | That folder's PGlite database. |
| `…/trash/` | Files and directories deleted from the UI. |
| `…/cache/classification/<hash>/<prompt hash>.json` | Cached classification responses. |
| `…/cache/extraction/<hash>/<schema hash>/…` | Cached extraction results, including per-page and per-chunk results. |
| `…/cache/converted/<hash>.csv` | XLS/XLSX/XLSM files converted to CSV. |
| `…/cache/categories-prompt/<document id>.json` | Category lists used in extraction prompts, when present. |
| `…/cache/eye/` | The Eye model download and `results.json`, the per-photo classification cache. |

Data folders from before workspaces kept `pgdata/`, `cache/` and `trash/` at the top level. On start they are moved into the workspace of the watch folder set at that time.

The cache is a filesystem replacement for zdocs' S3 cache with the same API ([packages/srv/src/extraction/s3-cache.ts](../packages/srv/src/extraction/s3-cache.ts)). Deleting `cache/` is safe: entries are recreated on demand, at the cost of new model calls. Deleting a workspace's `pgdata/` resets doc-ai for that watch folder; on the next start every file in it is ingested again.

The watch folder itself is only read, except for uploads and imports from the UI (see [Ingestion](ingestion.md)).
