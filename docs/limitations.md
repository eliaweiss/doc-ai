# Limitations and roadmap

doc-ai is at v1. This page lists what is known not to work yet and what is planned.

## What has been verified

Tested end to end on the Gateway provider with a synthetic one-page invoice PDF:

- A file dropped into the folder is classified as `INVOICE`, its header fields and three line items are extracted and it's indexed; the UI shows the data next to a file preview.
- Over MCP: `search_entities` (for example "toner"), `aggregate` (for example total per vendor), `list_searchable_entities` and `get_status`.
- Moving or renaming a file updates the document's path without creating a duplicate.
- `create_document_type` rejects schemas with `code` fields.

## Known gaps

**Ollama and PDFs.** zdocs sends PDFs to the model natively, which Gemini accepts and Ollama doesn't. The Ollama path needs a PDF-to-image rasterizer, ideally feeding the per-page extraction path. The Ollama provider itself (through its OpenAI-compatible endpoint) is wired up in [get-model-provider.ts](../packages/srv/src/ai/get-model-provider.ts) but **untested**.

**Retries on key errors.** Without a valid API key, `KEY_ERROR` jobs are retried on every worker tick (every 5 seconds). The retries are cheap but fill the log; they need a backoff ([worker.ts](../apps/server/src/worker.ts), [queue.ts](../packages/db-schema/src/queries/queue.ts)).

**File edits and deletions.** A file edited in place becomes a new document; the old one is kept. Deleted files are only logged, and their documents stay ([watcher.ts](../apps/server/src/watcher.ts)).

**Schema review.** Not implemented. Code formulas are off unless `DOC_AI_ALLOW_CODE_FORMULAS=true`, and MCP rejects schemas that contain them. See [Security](security.md#code-formulas).

**UI.**
- Only Files & Folders and Settings are offered in the app switcher (Extraction Templates opens from the Settings sidebar). API/Webhook, Home, billing, sharing and analytics are hidden or disabled.
- The document viewer calls QuickBooks/Xero status endpoints that return 404, treated as "not connected".
- The bundle is about 4.4 MB because chat and markdown components pull in shiki and mermaid.
- "Schema from sample" (upload a sample to generate a type) needs a local replacement for its S3 upload.

**Import from folder.** Photos only. PDFs are planned (rasterized first); HEIC isn't supported yet.

**Search.** The `vector` extension is enabled but there is no semantic search yet. `get_entity` for line items has a TODO to read from the search index ([getEntity.ts](../packages/srv/src/ui-tx/handlers/getEntity.ts)). Document-level aggregation isn't implemented ([aggregate.ts](../packages/srv/src/ui-tx/handlers/aggregate.ts)).

**Logs.** The copied pipeline's `console.log` calls are kept, so logs are verbose.

**Single process.** PGlite allows one process per data folder, so scripts that write to the database need the server stopped.

## Planned

- **Schema registry**: a format for public or downloadable schemas. Not designed yet.
- **Reconciliation ledger trace**: the workbench is ported; the ledger trace page (`/reconciliation/ledger`) and its saved-session routes aren't.
- PDF rasterization for Ollama and for Import from folder.
- Backoff for `KEY_ERROR` retries.
- Handling of in-place edits and deletions.
- A schema review step so code formulas can be accepted safely.

## Maintenance notes

- After changing [packages/db-schema/src/schemas](../packages/db-schema/src/schemas), run `npm run db:generate` (see [Scripts and migration](scripts.md#database-migrations)).
- When syncing copied code from zdocs, search for `doc-ai:` comments to find local edits that need to be re-applied.
