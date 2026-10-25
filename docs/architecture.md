# Architecture

## One process

doc-ai runs as a single long-lived Node.js process, the server in [apps/server](../apps/server). It owns one embedded PGlite database and runs four parts side by side:

| Part | File | Replaces in zdocs |
|---|---|---|
| Folder watcher | [apps/server/src/watcher.ts](../apps/server/src/watcher.ts) | S3 presigned upload + the upload-complete route |
| Queue worker | [apps/server/src/worker.ts](../apps/server/src/worker.ts) | The cron route, HTTP self-dispatch between steps, and the Lambda workers |
| HTTP server (UI + API) | [apps/server/src/main.ts](../apps/server/src/main.ts), [api.ts](../apps/server/src/api.ts), [local-routes.ts](../apps/server/src/local-routes.ts), [next-compat/](../apps/server/src/next-compat) | The Next.js app |
| MCP server | [apps/server/src/mcp.ts](../apps/server/src/mcp.ts), [photo-sort/mcp-tools.ts](../apps/server/src/photo-sort/mcp-tools.ts) | New (wraps zdocs' in-app agent handlers) |

Because PGlite is an in-process database, only one process can open a given data folder at a time. Tools that write to the database (such as the zdocs import script) must run with the server stopped.

## Data flow

1. A file lands in the watch folder (dropped in by you or a sync client, uploaded through the UI, or imported from another folder).
2. The **watcher** waits for the file to stop growing, hashes it, and either links it to an existing document (same content) or creates a new `documents` row and queues a `CLASSIFY` job in `ai_processing_queue`.
3. The **worker** claims pending jobs, runs `classifyDocument` and then `extractDocument` from the copied zdocs pipeline in [packages/srv/src/pipeline](../packages/srv/src/pipeline).
4. Classification and extraction call the configured AI model, cache responses under the data folder, write `document_data`, evaluate formulas, save notifications and finally **index** the document into `search_index`.
5. The **web UI** and **MCP clients** read and update the same tables through the zdocs query layer in [packages/db-schema](../packages/db-schema).

Details: [Ingestion](ingestion.md), [Processing pipeline](processing-pipeline.md), [Search](search.md).

## HTTP surface

Everything is served on one port (default 4310), bound to `127.0.0.1`. Routes are registered in this order in [main.ts](../apps/server/src/main.ts), so earlier ones win:

1. `/api/local/*`: the local API (status, documents, settings, upload, photo sort). See [HTTP API](http-api.md#local-api).
2. Local replacements for zdocs routes that depended on S3 or Lambda (`/api/uploads/*`, `/extract`, and stubs for features that don't exist locally), from [local-routes.ts](../apps/server/src/local-routes.ts).
3. The copied zdocs App Router handlers under [apps/server/src/zdocs-api](../apps/server/src/zdocs-api), discovered and mounted by [next-compat/mount-routes.ts](../apps/server/src/next-compat/mount-routes.ts).
4. A JSON 404 for any other `/api/*` path ("Not available in doc-ai").
5. `/mcp`: the MCP endpoint.
6. Static files from `apps/web/dist`, with every other path falling back to `index.html` so client-side routes work.

## Repository layout

The repository is an npm workspaces monorepo ([package.json](../package.json)) with two apps and six packages.

### Apps

| Path | Package | Role |
|---|---|---|
| [apps/server](../apps/server) | `@doc-ai/server` | The service. New code: watcher, worker, MCP, settings, local routes, Next.js route adapter, photo sort. Also holds the copied zdocs API handlers in `src/zdocs-api` and two migration scripts in `scripts/`. |
| [apps/web](../apps/web) | `@doc-ai/web` | The web UI shell: Vite + react-router around the copied zdocs client. Shims for Next.js imports in `src/shims`. |

### Packages

The packages keep their zdocs names (`@zdocs/...`) so copied files resolve their imports unchanged.

| Path | Package | Role |
|---|---|---|
| [packages/types](../packages/types) | `@zdocs/types` | Shared types and constants: documents, queue, field definitions, system schemas, model map, limits. |
| [packages/util](../packages/util) | `@zdocs/util` | Shared helpers (CSV/markdown export, edit application, validation helpers). |
| [packages/db-schema](../packages/db-schema) | `@zdocs/db-schema` | Drizzle schema, migrations and the whole query layer, on PGlite. Includes the data-folder resolver and the local-org bootstrap. |
| [packages/srv](../packages/srv) | `@zdocs/srv` | Server-side logic: AI provider selection, classification and extraction, formulas, notifications, the pipeline, storage helpers, the agent ("uiTx") handlers, and doc-ai's local config. |
| [packages/client](../packages/client) | `@zdocs/client` | The zdocs React client: pages, stores, providers, API helpers. |
| [packages/client-component](../packages/client-component) | `@zdocs/client-component` | UI component library (shadcn-style primitives, AI chat elements, pager). |

### Root files

- [.env.example](../.env.example): configuration template.
- [drizzle.config.ts](../drizzle.config.ts): migration generation config.
- [tsconfig.json](../tsconfig.json): repository-wide type checking, including the path mappings that redirect `next/server`, `next-auth` and `@/app/...` imports to the compatibility layer.

## Concurrency and robustness

- The watcher serializes ingestion, so two files with the same content can't both create documents.
- The worker processes up to `DOC_AI_WORKER_CONCURRENCY` jobs at a time (default 2), polls every 5 seconds, and is "kicked" immediately whenever something is enqueued or a job finishes.
- On start, the worker resets every job left `IN_PROGRESS` by a previous run, since only one process can have been running them.
- Pipeline failures update job and document status inside the copied pipeline functions (retries, permanent failure, `KEY_ERROR`), so the worker itself stays thin.
- Shutdown on SIGINT/SIGTERM stops the worker and watcher and closes the database.
