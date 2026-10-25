# Getting started

## Requirements

- Node.js 20 or later and npm (the repository is an npm workspaces monorepo; see the root [package.json](../package.json)).
- An AI provider:
  - **Vercel AI Gateway** (default): you need an `AI_GATEWAY_API_KEY`. The default models are Google Gemini models, routed through the Gateway.
  - **Ollama** (experimental): a local Ollama server with a vision model. This path is wired up but untested, and PDFs don't work with it yet (see [Limitations](limitations.md)).
- macOS or Linux if you want Import from folder: the Eye photo classifier ships native cores for Core ML (macOS) and LiteRT (Linux).

## Install and run

1. Install dependencies with `npm install` at the repository root.
2. Copy [.env.example](../.env.example) to `.env` and set at least `DOC_AI_WATCH_DIR` (the folder to watch) and `AI_GATEWAY_API_KEY`. Both can also be set later from the Settings page.
3. Run `npm start`. This builds the web UI (`apps/web` → `apps/web/dist`) and then starts the server (`apps/server`), which loads `.env` from the repository root.

On start the server:

- creates the data folder (default `~/.doc-ai`),
- opens the PGlite database, enables the `pg_trgm` and `vector` extensions and applies migrations ([apps/server/src/db.ts](../apps/server/src/db.ts)),
- creates the local user, organization, root folder, system document types and default quick-access shortcuts if they don't exist ([packages/db-schema/src/queries/local.ts](../packages/db-schema/src/queries/local.ts)),
- starts the queue worker and the folder watcher,
- serves the UI, the API and MCP on `http://localhost:4310` (bound to `127.0.0.1` only).

The startup sequence is in [apps/server/src/main.ts](../apps/server/src/main.ts).

If no Gateway key is set, the server warns at start and documents wait in the `KEY_ERROR` state until a key is configured; they are retried automatically.

## First steps in the UI

- Open `http://localhost:4310`. You land on `/folder`, the drive.
- Drop a PDF or image into the watch folder (or use **New → Upload** in the UI). Within a few seconds it appears in the drive and moves through the statuses `PENDING` → `PARTIAL` → `EXTRACTED` → `INDEXED`.
- Open the document to see the extracted header fields and line items next to a preview of the file. Fields can be edited in place.
- Open **Settings → Processing** to change the watch folder, provider, key and models, and to run a connection test.
- Open **Extraction Templates** (`/schema`) to look at the built-in document types or create your own.
- Open **Search** (`/search`) to search across all extracted entities.

## Connecting an MCP client

The MCP endpoint is `http://localhost:4310/mcp`, using the stateless Streamable HTTP transport.

- Clients that support remote HTTP MCP servers can use the URL directly.
- Claude Desktop needs the `mcp-remote` bridge: add an MCP server entry named `doc-ai` whose command runs `mcp-remote` (through `npx`) with the doc-ai MCP URL as its argument. The exact snippet is in the top-level [README](../README.md#connecting-an-mcp-client).

Once connected, try asking "what's the doc-ai status?", "list my invoices from March", or "find the receipts in ~/Pictures/2025 and import them". The full tool list is in [MCP server](mcp-server.md).

## Development mode

- `npm run dev` starts the server with `tsx watch`, restarting on server code changes (port 4310).
- `npm run dev:web` starts Vite on port 4311 with hot reload, proxying `/api` and `/mcp` to the server ([apps/web/vite.config.ts](../apps/web/vite.config.ts)). Set `DOC_AI_SERVER_URL` if the server runs elsewhere.
- `npm run typecheck` type-checks the whole repository against the root [tsconfig.json](../tsconfig.json).
- `npm run db:generate` regenerates migrations after a schema change (see [Scripts and migration](scripts.md)).

## Stopping

Ctrl-C (SIGINT) or SIGTERM stops the worker and watcher, closes the HTTP server and closes the database cleanly. Jobs that were in progress are reset and retried on the next start.
