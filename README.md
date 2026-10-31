# DocAI

Think of DocAI as Google Drive for your financial documents, except it runs on your own computer, keeps your files private and is open source. It's built for invoices, receipts, bank statements and transactions.

## How it works

1. **Connect a folder.** Any folder works, including a Google Drive folder synced to your computer.
2. **Data is extracted automatically.** Every document in the folder is recognized (invoice, receipt, bank statement…) and its data is pulled into a structured schema: vendor, date, totals, line items, transactions. DocAI ships with schemas for common documents, and you can create your own.
3. **Work with your data.** Browse & Search in a Drive-like web UI, and match payments to invoices with the built-in reconciliation tool.

## Even better: connect an AI assistant

DocAI is also an MCP server, so you can connect Claude (or another AI assistant) and simply ask it to:

- Sort your documents
- Arrange them in folders
- Search them ("how much did I spend on software in March?")
- Reconcile payments with invoices
- Build custom mini apps

## Mini apps: no AI needed to run them

A mini app is a custom tool built on top of your data, such as a monthly expense report, a VAT summary or a vendor dashboard. The AI helps you *build* it once; after that, it runs on its own without calling an AI model. That makes mini apps:

- **Faster**: no waiting for a model to answer
- **Deterministic**: the same input always gives the same result
- **Cheaper**: no tokens spent each time you run them

They are also the way to stay fully private. Use Claude Code to build a mini app on a few sample documents, then run it on your real documents completely offline, with no data sent to any AI service. Even if privacy isn't your concern, mini apps save tokens on any task you repeat.

DocAI is the open-source, local version of [zdocs](#how-it-reuses-zdocs). The rest of this README covers setup and technical details.

## Quick start

```bash
npm install
cp .env.example .env   # set DOC_AI_WATCH_DIR and AI_GATEWAY_API_KEY
npm start              # builds the web UI, then starts the service
```

- UI: http://localhost:4310 (`/folder`, `/document/:id`, `/schema`, `/search`, `/ocr`)
- MCP (Streamable HTTP): http://localhost:4310/mcp

The service binds to `127.0.0.1` only and has no auth.

### Configuration

Settings → **Processing** in the UI sets the watch folder (the watcher restarts live), the model provider, the AI Gateway model for each step (saved in the database), the Gateway key and the Ollama URL and model. It also has a connection test. The other values are saved to `~/.doc-ai/settings.json` (owner-only permissions) and override `.env`. The table below lists the environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `DOC_AI_WATCH_DIR` | — | Folder to watch (subfolders included). Never written to, except by UI uploads. |
| `DOC_AI_DATA_DIR` | `~/.doc-ai` | PGlite database (`pgdata/`), caches (`cache/`) and `settings.json`. Can also be set on the Settings page (saved in `~/.doc-ai/data-dir.json`, applied on restart); the env var wins |
| `DOC_AI_PROVIDER` | `gateway` | `gateway` (Vercel AI Gateway) or `ollama` |
| `AI_GATEWAY_API_KEY` | — | Gateway key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server |
| `DOC_AI_OLLAMA_MODEL` | `qwen3.5:9b` | Vision model used for every step |
| `DOC_AI_WORKER_CONCURRENCY` | `2` | Documents processed in parallel |
| `DOC_AI_ALLOW_CODE_FORMULAS` | off | Runs schema `code` formulas. They are **unsandboxed**. |
| `PORT` | `4310` | HTTP port |

### Connecting an MCP client

Clients that support remote HTTP MCP can use `http://localhost:4310/mcp` directly. For Claude Desktop, use the `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "doc-ai": { "command": "npx", "args": ["-y", "mcp-remote", "http://localhost:4310/mcp"] }
  }
}
```

#### Claude Code plugin

This repository is also a Claude Code plugin marketplace. The `doc-ai` plugin ([plugins/doc-ai](plugins/doc-ai)) connects Claude Code to the MCP server and adds a `doc-ai` skill that teaches it how to use the tools (search vs. aggregate, aggregation limits, corrections, photo import, mini apps). In Claude Code:

```
/plugin marketplace add eliaweiss/doc-ai
/plugin install doc-ai@doc-ai
```

From a local checkout, use `/plugin marketplace add ./path/to/doc-ai` instead. Set `DOC_AI_MCP_URL` if the server isn't at `http://localhost:4310/mcp`. If you already added DocAI as an MCP server by hand, remove that entry (`claude mcp remove doc-ai`) so the tools aren't listed twice.

Tools: `get_status`, `list_document_types`, `get_document_type`, `create_document_type`, `list_documents`, `get_document`, `list_searchable_entities`, `search_entities`, `get_entity`, `aggregate`, `update_entity_fields`, `reprocess_document`, `list_reconciliation_links`, `trace_reconciliation`, `create_reconciliation_link`, `delete_reconciliation_link`, `list_folders`, `create_folder`, `rename_folder`, `move_folder`, `delete_folder`, `move_documents`, `get_mini_app_guide`, `list_mini_apps`, `get_mini_app`, `create_mini_app`, `update_mini_app`, `find_documents_in_folder`, `get_folder_scan`, `import_photos` (plus `get_photo_thumbnails`, which only the picker UI calls). They cover everything mini apps can do through the uiTx SDK, so one-off changes can be asked for in chat; see [MCP server](docs/mcp-server.md#mcp-tools-and-the-mini-app-sdk). `move_documents` and `update_entity_fields` also take a filter (`select`) with a dry run, for changing many records in one call ([Bulk changes](docs/mcp-server.md#bulk-changes)).


## Architecture

There is one Node process (`apps/server`). It owns one embedded PGlite database and runs four parts:

```
watch folder ──► watcher ──► documents + ai_processing_queue (PGlite)
                                   │
                      worker loop ─┴─► classifyDocument ─► extractDocument ─► indexDocument
                                        (zdocs pipeline, unchanged)
HTTP :4310  ├─ /        zdocs client, built with Vite (apps/web)
            ├─ /api/*   zdocs route handlers (copied) + local upload/file routes
            └─ /mcp     MCP server (wraps zdocs uiTx handlers)
```

- **Watcher** (`apps/server/src/watcher.ts`) waits for file sizes to settle, skips temp and placeholder files, and dedupes by MD5 like zdocs. If a known hash appears at a new path, it's treated as a rename. Like zdocs' upload route, it converts XLS/XLSX files to CSV, writing the CSV to the cache dir. The watcher replaces zdocs' S3 upload and `uploads/[id]/complete` route.
- **Worker** (`apps/server/src/worker.ts`) claims jobs with zdocs' `claimPendingJobs` and calls the pipeline functions directly. It replaces the cron route, the HTTP self-dispatch and Lambda. When it starts, it resets jobs left `IN_PROGRESS` by an earlier run.
- **DB** (`packages/db-schema`): zdocs' Drizzle schema and queries on PGlite (with `pg_trgm` and `vector`). Migrations run when the service starts (`packages/db-schema/migrations`). A fixed org row (`id: "local"`) keeps zdocs' `*ForOrg(orgId, …)` queries unchanged.

### Folders = directories

The watch folder's directory tree is the folder tree; the root folder is the watch folder itself. Sync runs both ways (`apps/server/src/folder-sync.ts`, `folder-routes.ts`, `watcher.ts`):

| You do this | DocAI does this |
|---|---|
| Add a file in a subdirectory | Document goes into the matching folder; missing folders are created |
| Create a directory on disk | Folder created |
| Move or rename a file on disk | Document follows, folder included |
| Remove a directory on disk | Its folder is dropped once nothing is left in it |
| Create a folder in the UI | Directory created |
| Rename or move a folder in the UI | Directory renamed or moved |
| Move a document in the UI, or a folder rule routes it | File moved |
| Upload in the UI | File written to the folder's full path |
| Delete a folder or document in the UI | Directory or file moved to `<data dir>/trash/<time>/`, never deleted. Deleting a folder also deletes the documents and subfolders inside it. |

Folder names that would map to an existing sibling directory (case-insensitive) are rejected. Removing a file on disk still keeps its document.

### Web UI (`apps/web`)

The zdocs client (`packages/client`, `packages/client-component`) is copied unchanged and runs on Vite + react-router instead of Next.js:

- `src/main.tsx` + `src/routes.tsx` replace zdocs' Next layouts and the thin `(pages)/.../page.tsx` wrappers.
- Vite aliases (`vite.config.ts`) point `next/navigation`, `next/link`, `next/image`, `next-auth/react`, `next-auth` and `next-intl` at small shims in `src/shims/` (react-router, always-signed-in local user, `use-intl`).
- Pages are imported by deep path, so zdocs features that weren't ported (billing, the AI builder, integrations) are left out of the bundle unless a kept page imports them.

The API the client calls is zdocs' own App Router handlers, copied to `apps/server/src/zdocs-api/` and mounted on Hono by `src/next-compat/mount-routes.ts`. tsconfig `paths` map `next/server`, `next-auth/next` and `@/app/...` to `src/next-compat/`. The S3/Lambda routes (presigned upload, upload-complete, file download, extract) are replaced by `src/local-routes.ts` with the same request/response contract. Uploads land in the watch folder, under a subfolder named after the UI folder. Any other `/api/*` call gets a JSON 404.

For UI development, run `npm run dev` (server on :4310) and `npm run dev:web` (Vite on :4311, proxying `/api` and `/mcp`).

## How it reuses zdocs

`packages/*` keep zdocs' package names (`@zdocs/types`, `@zdocs/util`, `@zdocs/db-schema`, `@zdocs/srv`), so the copied files resolve their imports unchanged.

| Package | Source | Changes |
|---|---|---|
| `types` | zdocs `packages/types` | Removed the next-auth type augmentation |
| `util` | zdocs `packages/util` | None |
| `db-schema` | zdocs `packages/db-schema` | `db.ts` uses PGlite instead of Neon/postgres-js; `index.ts` is trimmed; tables and queries for billing, auth flows, integrations, mini-apps, tasks and contact-us are removed; `queries/org-billing-settings.ts` is a stub; `queries/local.ts` is new (local org bootstrap, lookup by hash or path) |
| `srv` | zdocs `packages/srv` (`extraction/`, `pipeline/`, `storage/file-*`, `ui-tx/handlers`, `chat/ui-tx-prompt-docs`) | `extraction/s3-cache.ts` uses the filesystem (same API); `billing/get-model-provider.ts` is config-driven (Gateway or Ollama); `ai-usage-service.ts` logs usage without deducting credits; credit errors, the circuit breaker and the task scheduler are stubs; code formulas are gated in `formula-service.ts`; `ui-tx/handleUiTxRequest.ts` keeps only the context type |
| `client`, `client-component` | zdocs `packages/client*` | None; third-party deps moved to `apps/web/package.json` |
| `apps/server/src/zdocs-api` | zdocs `src/app/api` (documents, folders, document-types, search, saved-queries, notifications, quick-access, org) | None |
| `apps/web` | new (Vite shell + shims) | — |
| `apps/server` | new | watcher, worker, MCP, Next route adapter, local upload/file routes |

The pipeline's HTTP self-dispatch is not removed; it simply doesn't run, because `NEXT_PUBLIC_URL` is unset.

## v1 status: what works

Tested end to end on the Gateway with a synthetic one-page invoice PDF:

- File dropped into the folder → classified as `INVOICE` → header fields and 3 line items extracted → indexed. The UI shows the data with a file preview.
- MCP: `search_entities("toner")`, `aggregate` (sum per schemaType), `list_searchable_entities`, `get_status`.
- Moving or renaming a file updates the document's path; no duplicate is created.
- `create_document_type` rejects schemas with `code` fields.

## Known gaps, to iterate on

- **Ollama + PDFs**: zdocs sends PDFs natively (`data:application/pdf`), which Gemini accepts and Ollama doesn't. The Ollama path needs a PDF→image rasterizer (for example pdfjs-dist + @napi-rs/canvas, or mupdf wasm), ideally fed to the per-page extraction path. The Ollama provider (OpenAI-compatible `/v1`) is wired up but **untested**: no local models on the dev machine.
- **KEY_ERROR retries**: without an API key, jobs are retried on every worker tick (5 s). The retries are cheap but spam the log. Add backoff.
- **File edits and deletes**: a file edited in place becomes a new document. Deleted files are only logged.
- **Schema review**: not implemented. Code formulas are off unless you set `DOC_AI_ALLOW_CODE_FORMULAS=true`, and MCP rejects schemas that contain them.
- **UI**: the app switcher shows Files & Folders and Settings; Extraction Templates opens from the Settings sidebar. API/Webhook, Home, billing, sharing and analytics are hidden or disabled (`doc-ai:` comments mark each edit to the copied client). The document viewer calls the QuickBooks/Xero status endpoints, which return 404; the client treats that as "not connected". The bundle is large (about 4.4 MB) because the chat/markdown components pull in shiki and mermaid. `upload-sample` (schema from sample) needs a local replacement for its S3 upload.
- **Schema registry**: the format for public or downloadable schemas is not designed yet.
- **Reconciliation**: the workbench (`/reconciliation/workbench`), the uiTx reconciliation methods and their MCP tools are ported; the ledger trace view isn't.
- **Migrations**: when you change `packages/db-schema/src/schemas`, run `npm run db:generate`.
- The pipeline logs are verbose (zdocs' `console.log`s are kept as-is).
