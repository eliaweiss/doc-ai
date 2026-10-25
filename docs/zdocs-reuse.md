# Relationship to zdocs

doc-ai is the open-source, local edition of zdocs, a hosted multi-tenant document intelligence product. The strategy is to **copy zdocs code unchanged wherever possible** and replace only the infrastructure around it. That keeps the two code bases close, so fixes and features can move between them.

## The approach

- **Keep package names.** The packages under [packages/](../packages) keep their zdocs names (`@zdocs/types`, `@zdocs/util`, `@zdocs/db-schema`, `@zdocs/srv`, `@zdocs/client`, `@zdocs/client-component`), so copied files resolve their imports without edits.
- **Keep the org-scoped API.** Instead of removing multi-tenancy, doc-ai creates one fixed organization (`local`) and passes it everywhere ([local.ts](../packages/db-schema/src/queries/local.ts)).
- **Swap infrastructure behind the same interfaces.** S3 becomes the filesystem, Neon becomes PGlite, Lambda and cron become an in-process worker, Next.js becomes Hono (server) and Vite (client), NextAuth becomes an always-signed-in local user, billing becomes plain configuration.
- **Mark every edit.** Changes inside copied files carry a `doc-ai:` comment.

## Package by package

| Package | Copied from | Changes in doc-ai |
|---|---|---|
| `types` | zdocs `packages/types` | Removed the NextAuth type augmentation. |
| `util` | zdocs `packages/util` | None. |
| `db-schema` | zdocs `packages/db-schema` | [db.ts](../packages/db-schema/src/db.ts) uses PGlite instead of Neon/postgres-js; [index.ts](../packages/db-schema/src/index.ts) is trimmed; tables and queries for billing, auth flows, integrations, tasks and contact-us are removed; org billing settings are a stub; new files [local.ts](../packages/db-schema/src/queries/local.ts) (local org bootstrap, lookup by hash or path) and [data-dir.ts](../packages/db-schema/src/data-dir.ts) (data folder resolution); new table `ai_model_settings`. Mini-app tables and queries are kept. |
| `srv` | zdocs `packages/srv` (`extraction/`, `pipeline/`, `storage/file-*`, `ui-tx/handlers`, `chat/ui-tx-prompt-docs`) | [s3-cache.ts](../packages/srv/src/extraction/s3-cache.ts) uses the filesystem with the same API; [get-model-provider.ts](../packages/srv/src/ai/get-model-provider.ts) is config-driven (Gateway or Ollama) instead of billing-driven; [ai-usage-service.ts](../packages/srv/src/ai/ai-usage-service.ts) logs usage without deducting credits; credit errors, the circuit breaker and the task scheduler ([task-scheduler.ts](../packages/srv/src/services/task-scheduler.ts)) are stubs; code formulas are gated in [formula-service.ts](../packages/srv/src/extraction/formula-service.ts); [handleUiTxRequest.ts](../packages/srv/src/ui-tx/handleUiTxRequest.ts) drops the reconciliation methods; new folder [local/](../packages/srv/src/local) (config and path resolution). |
| `client`, `client-component` | zdocs `packages/client*` | Small UI edits marked `doc-ai:` (see [Web UI](web-ui.md#edits-to-the-copied-client)), plus the new Import from Folder dialog and Processing settings section. Third-party dependencies moved to [apps/web/package.json](../apps/web/package.json). |
| `apps/server/src/zdocs-api` | zdocs `src/app/api` (documents, folders, document-types, search, saved-queries, notifications, quick-access, org, mini-apps, ui-tx) | `ui-tx/route.ts` drops API-key auth. |
| `apps/web` | New | Vite shell and Next.js shims. |
| `apps/server` (rest) | New | Watcher, worker, MCP, settings, Next route adapter, local upload/file routes, photo sort. |

## Infrastructure mapping

| zdocs | doc-ai | Where |
|---|---|---|
| S3 bucket for documents | The watch folder | [s3-cache.ts](../packages/srv/src/extraction/s3-cache.ts), [paths.ts](../packages/srv/src/local/paths.ts) |
| S3 cache bucket | `<data folder>/cache` | [s3-cache.ts](../packages/srv/src/extraction/s3-cache.ts) |
| Presigned upload + upload-complete route | Folder watcher + local upload routes | [watcher.ts](../apps/server/src/watcher.ts), [local-routes.ts](../apps/server/src/local-routes.ts) |
| Cron route claiming jobs, HTTP self-dispatch, Lambda workers | In-process worker loop | [worker.ts](../apps/server/src/worker.ts) |
| Neon / postgres-js | PGlite with `pg_trgm` and `vector` | [db.ts](../packages/db-schema/src/db.ts) |
| Next.js App Router API | Hono + route adapter | [mount-routes.ts](../apps/server/src/next-compat/mount-routes.ts) |
| Next.js pages | Vite + react-router | [apps/web](../apps/web) |
| NextAuth sessions | Fixed local user | [next-auth.ts](../apps/server/src/next-compat/next-auth.ts), [next-auth-react.tsx](../apps/web/src/shims/next-auth-react.tsx) |
| Billing profile picks the models; credits deducted per call | Settings pick the models; usage only logged | [get-model-provider.ts](../packages/srv/src/ai/get-model-provider.ts), [ai-usage-service.ts](../packages/srv/src/ai/ai-usage-service.ts) |
| In-app AI agent (uiTx) | MCP server | [mcp.ts](../apps/server/src/mcp.ts) |

## Leftovers that are intentionally harmless

- The pipeline still contains zdocs' HTTP self-dispatch to the next step and the completion callback. They only run when `NEXT_PUBLIC_URL` is set, which it isn't in doc-ai, so the in-process worker drives the steps instead.
- The zdocs `console.log` calls in the pipeline are kept as they are, so logs are verbose.
- Tables for features that aren't ported (reconciliation, institutions, auth) stay in the schema so foreign keys and copied queries keep working.

## Not ported

Billing and credits, multi-user auth and sharing, organizations in the UI, integrations (QuickBooks, Xero, Plaid bank links), inbound email and webhooks, API keys, the mini-app AI builder (mini apps themselves run, view only; see [Mini apps](mini-apps.md)), tasks, and reconciliation (planned for v2). Some of their client code is still in [packages/client/src/pages](../packages/client/src/pages) but isn't routed or bundled.
