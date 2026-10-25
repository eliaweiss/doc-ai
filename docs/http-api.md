# HTTP API

All routes are served by the one server process on port 4310, bound to `127.0.0.1`, with no authentication. They fall into three groups, registered in this order in [apps/server/src/main.ts](../apps/server/src/main.ts).

## Local API

Mounted at `/api/local`, defined in [apps/server/src/api.ts](../apps/server/src/api.ts). These are doc-ai's own routes.

| Method and path | Purpose |
|---|---|
| `GET /api/local/settings` | Current settings for the Settings page. The Gateway key is never returned, only whether it's set, its last four characters and its source. Also lists the model per pipeline step, its default and every selectable model. |
| `POST /api/local/settings` | Validate and save settings (see [Configuration](configuration.md#the-settings-page-settings--processing)). Restarts the watcher if the watch folder changed. Validation problems return 400 with a message. |
| `POST /api/local/settings/test` | One tiny model call with the classification model; returns success, model, reply and latency, or the error. |
| `GET /api/local/status` | Same as the `get_status` MCP tool. |
| `GET /api/local/documents` | Documents, newest first. `limit` (default 200, max 1000) and `offset`. |
| `GET /api/local/documents/:id` | Document, extracted data, notifications and its document type. |
| `GET /api/local/documents/:id/file` | The original file bytes, inline, for previews. Uses `metadata.sourcePath` when present, so converted spreadsheets return the original. |
| `POST /api/local/documents/:id/reprocess` | Queue classification and extraction again. |
| `GET /api/local/document-types` | Summary of all document types. |
| `POST /api/local/upload` | Multipart upload of one or more files into the watch folder root (name clashes get a numeric suffix). The watcher then ingests them. |
| `/api/local/photo-sort/*` | Import from folder; see below. |

### Photo sort routes

Defined in [apps/server/src/photo-sort/routes.ts](../apps/server/src/photo-sort/routes.ts) and used by the Import from Folder dialog.

| Method and path | Purpose |
|---|---|
| `GET /dirs?dir=…` | Subfolders of a folder (hidden ones excluded) and its parent, for the folder browser. Defaults to the home folder. |
| `POST /scan` | Start a scan of `{ folder }`; returns the scan view (ID, status, progress, counts, items). |
| `GET /scan/:id` | Poll a scan. `screenshots=1` adds screenshots; `all=1` returns every photo. |
| `GET /thumb?path=…` | JPEG thumbnail, only for a path returned by a kept scan. |
| `GET /folders` | doc-ai folders to import into. |
| `POST /import` | Import `{ paths, folderId?, folderName? }`; returns imported, skipped and failed lists. |

## Local replacements for zdocs routes

[apps/server/src/local-routes.ts](../apps/server/src/local-routes.ts) implements zdocs routes that depended on S3 or Lambda, with the same request and response shapes the copied client expects:

| Method and path | zdocs behaviour | doc-ai behaviour |
|---|---|---|
| `POST /api/uploads/aws` | Create a document and return a presigned S3 URL | Create the document with a path in the watch folder and return a local PUT URL (or the existing document if the hash is known) |
| `PUT /api/uploads/local/:id` | (S3) | Write the bytes into the watch folder |
| `POST /api/uploads/:id/complete` | Mark complete, convert spreadsheets, queue | Same, via `finishIngest` |
| `GET /api/uploads/:id/:fileName` | Download from S3 | Read from the watch folder or cache |
| `POST /api/org/:orgId/documents/:documentId/extract` | Run extraction on Lambda | Re-queue in the local worker |

It also answers a few calls the shared UI shell makes for features that don't exist locally, so pages load cleanly: user-journey analytics events (accepted and dropped), and webhook / inbound-email address generation (no-op).

Upload flow details are in [Ingestion](ingestion.md#2-uploads-from-the-web-ui).

## Copied zdocs API handlers

The zdocs client talks to zdocs' own Next.js App Router handlers. doc-ai copies them unchanged into [apps/server/src/zdocs-api](../apps/server/src/zdocs-api) and runs them on Hono.

### How they're mounted

[next-compat/mount-routes.ts](../apps/server/src/next-compat/mount-routes.ts) walks the folder for `route.ts` files at startup and turns each folder path into a Hono route: `org/[orgId]/documents/[documentId]/route.ts` becomes `/api/org/:orgId/documents/:documentId`. Every exported `GET`, `POST`, `PUT`, `PATCH` or `DELETE` is registered and called the way Next.js 15 calls it: with a `NextRequest` and a context whose `params` is a promise. Routes are sorted so static segments win over parameters (so `/documents/status` isn't captured by `/documents/:documentId`).

The handlers' Next.js imports resolve to a minimal compatibility layer through `paths` in the root [tsconfig.json](../tsconfig.json):

- `next/server` → [next-compat/server.ts](../apps/server/src/next-compat/server.ts): `NextRequest` (with `nextUrl`) and `NextResponse` (`json`, `redirect`).
- `next-auth` / `next-auth/next` → [next-compat/next-auth.ts](../apps/server/src/next-compat/next-auth.ts): `getServerSession` always returns the local user.
- The zdocs auth config import → [next-compat/auth-config.ts](../apps/server/src/next-compat/auth-config.ts), an empty object.

Org access checks still run ([userCanAccessOrgId.ts](../apps/server/src/zdocs-api/org/functions/userCanAccessOrgId.ts)) and pass for the local user and org.

### Routes included

| Area | Routes under `/api/org/:orgId` |
|---|---|
| Organization | the org itself (`POST`), plus `POST /api/org/list-org` |
| Documents | list (`POST /documents`), statuses (`POST /documents/status`), and per document: get, `get-doc`, `save-doc`, `update`, `change-type`, `move`, `delete`, `index`, `extract-sum`, `toggle-duplicate` |
| Folders | list, `create`, and per folder `rename`, `move`, `delete` |
| Document types | list, `create-custom`, `create-from-system`, `dry-run-formula`, and per type `update`, `delete` |
| Search | `search/entity`, `search/searchable-entities`, `reindex` |
| Saved queries | list/create, and get/update/delete per query |
| Notifications | list, and update per notification |
| Quick access | get, add, remove, reorder |
| Reconciliation | `reconciliation/create-link`, `reconciliation/delete`, `reconciliation/links/get`, `reconciliation/links/:id/delete`, `reconciliation/get-reconciled-IdsToType`, `reconciliation/get-reconciled-TypeToIds`, `reconciliation/trace`, `saved-reconciliation-sessions` (list/create, and get/update/delete per session), `documents/:documentId/get-reconciliation` |
| Mini apps | `mini-apps/list-miniapps`, `mini-apps/create`, and get/update/delete per app (see [Mini apps](mini-apps.md)) |

Outside `/api/org`, `POST /api/ui-tx` is the uiTx SDK endpoint used by mini apps. It keeps zdocs' session path only; the API-key path is removed because doc-ai has no API keys.

## Everything else

Any other `/api/*` path returns a JSON 404, "Not available in doc-ai: …". This covers the zdocs features that weren't ported (billing, integrations such as QuickBooks and Xero, the AI builder, tasks, the reconciliation ledger trace's saved sessions, sharing). The client treats, for example, a 404 from the QuickBooks status endpoint as "not connected".

## Static files

After the API and `/mcp`, the server serves `apps/web/dist` and falls back to `index.html` for every other path so the single-page app's routes work on reload.
