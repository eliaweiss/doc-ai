# Scripts and migration

## npm scripts

Defined in the root [package.json](../package.json):

| Script | What it does |
|---|---|
| `npm start` | Builds the web UI, then starts the server with `.env` loaded. |
| `npm run build` | Builds the web UI only (`apps/web/dist`). |
| `npm run dev` | Starts the server in watch mode (restarts on server code changes). |
| `npm run dev:web` | Starts the Vite dev server on port 4311, proxying the API and MCP to the server. |
| `npm run db:generate` | Generates a new SQL migration from the Drizzle schema with drizzle-kit ([drizzle.config.ts](../drizzle.config.ts)). |
| `npm run typecheck` | Type-checks the whole repository. |

## Database migrations

- The schema source of truth is the Drizzle definitions in [packages/db-schema/src/schemas](../packages/db-schema/src/schemas).
- After changing them, run `npm run db:generate`. drizzle-kit writes a new SQL file and snapshot into [packages/db-schema/migrations](../packages/db-schema/migrations) and updates [meta/_journal.json](../packages/db-schema/migrations/meta/_journal.json).
- Migrations are applied automatically at server start by the PGlite migrator ([apps/server/src/db.ts](../apps/server/src/db.ts)), after the `pg_trgm` and `vector` extensions are enabled.

Existing migrations: `0000_init` (the zdocs schema minus removed features), `0001_quick_access`, `0002_ai_model_settings`.

## Moving data from zdocs to doc-ai

Two scripts in [apps/server/scripts](../apps/server/scripts) copy a whole zdocs organization into a local doc-ai, already classified and extracted, so no AI calls are needed.

### 1. Export from zdocs

[export-from-zdocs.cjs](../apps/server/scripts/export-from-zdocs.cjs) runs against a zdocs installation and uses zdocs' own `node_modules` (located through `ZDOCS_DIR`, default `~/work/zdocs`). It needs zdocs' database URL and AWS credentials in the environment and the organization ID in `ZDOCS_ORG_ID`. It takes an output folder and a manifest path.

- The database connection is **read-only** (enforced with a read-only default transaction).
- It exports the organization's live folders, document types and documents, plus institutions, extracted data, notifications, reconciliation links, saved reconciliation and ledger-trace sessions, saved queries, and mini apps.
- It downloads each document's original file from S3 (eight at a time) into the output folder, mirroring the zdocs folder tree (the root folder is the output folder itself), with safe file names and de-duplicated paths. Each file's MD5 is recorded.
- The manifest (version 2) holds the org ID, the table rows and the file list.

### 2. Import into doc-ai

[import-zdocs-export.ts](../apps/server/scripts/import-zdocs-export.ts) runs in doc-ai with **the doc-ai server stopped** (PGlite is single-process). It takes the manifest and the folder of exported files, and needs `DOC_AI_WATCH_DIR`.

- It refuses to run if the local database already has documents: import into a fresh data folder.
- It initializes the database, then deletes the seeded folders and document types, because the exported ones replace them. IDs are kept, so folder mappings and default folders keep working.
- It inserts rows table by table in foreign-key order (folders, document types, institutions, documents, document data, notifications, reconciliation data, saved queries, mini apps). Only columns that exist both in the export and locally are copied; every row is reassigned to the local org, and user columns to the local user. Postgres converts each column type from JSON.
- With `--mini-apps-only` in place of the files folder, it inserts only the mini apps and skips the empty-database check, for adding them to an existing install.
- Documents are repointed at the watch folder (bucket `local`, path from the export, hash from the file), with `importedFrom` recorded in their metadata.
- The files are copied into the watch folder with the same tree. When the server starts, the watcher sees known hashes at known paths and does nothing.
- The search index is rebuilt locally for every document.
