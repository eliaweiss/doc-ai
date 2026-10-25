# Mini apps

Mini apps are small HTML/JS/CSS apps, built in zdocs' AI builder, that read and update your documents through the **uiTx SDK**. doc-ai runs them but doesn't include the builder: there's no chat, code view, console or version history in the UI. Creating and editing apps through the MCP server is planned.

## Using them

- **Apps** (`/apps`, the last entry in the app menu) lists the pinned apps first (drag to reorder the app menu), then every other system app and mini app. Click one to open it. The switch adds it to or removes it from the app menu.
- **`/app/:miniAppId`** runs one app under the header, with refresh, print, fullscreen and close buttons ([MiniAppPage.tsx](../packages/client/src/pages/mini-apps/MiniAppPage.tsx)).

## How an app runs

1. The page loads the app's `code` and renders it with zdocs' [MiniAppViewer.tsx](../packages/client/src/components/ui-tx/MiniAppViewer.tsx) in a sandboxed `srcdoc` iframe, with the theme script injected.
2. The app includes the SDK, `<script src="/sdk/ui-tx/v1.js">`, served from [apps/web/public/sdk/ui-tx](../apps/web/public/sdk/ui-tx) (a built copy of zdocs' `packages/ui-tx`). Apps built in zdocs point at the zdocs host; the page rewrites that URL to the local copy at render time, without changing the stored code.
3. The SDK (`window.zDocs.uiTx`) posts `UITX_REQUEST` messages to the parent window. [useUiTxMessageHandler.ts](../packages/client/src/hooks/useUiTxMessageHandler.ts) handles `ui.*` helpers (toast, confirm, open document/folder) in the browser and forwards data calls to `POST /api/ui-tx`.
4. [/api/ui-tx](../apps/server/src/zdocs-api/ui-tx/route.ts) checks the org and calls [handleUiTxRequest.ts](../packages/srv/src/ui-tx/handleUiTxRequest.ts), which dispatches to the same handlers the MCP tools use: `getSession`, `searchEntities`, `getEntity`, `listDocuments`, `aggregate`, `updateEntityFields`. The reconciliation methods are v2 and answer `UNSUPPORTED`.

The iframe runs with `allow-same-origin`, so an app has the same access to the local API as the web UI. Only run apps you trust; see [Security](security.md).

## Storage and API

Apps live in the `mini_apps` table; every create and update also writes a snapshot to `mini_apps_history` ([data model](data-model.md#supporting)). The copied zdocs routes under `/api/org/:orgId/mini-apps` are `list-miniapps`, `create`, and get (`POST`), update (`PUT`) and delete (`DELETE`) per app. Create and update are there for the coming MCP tools; the UI only reads.

## Importing apps from zdocs

`export-from-zdocs.cjs` exports the org's `mini_apps` rows along with everything else, and `import-zdocs-export.ts` imports them. To add only the mini apps to a DB that already has your documents, stop the server and run:

```bash
npx tsx --env-file=../../.env scripts/import-zdocs-export.ts <manifest.json> --mini-apps-only
```

from `apps/server`. See [Scripts and migration](scripts.md).
