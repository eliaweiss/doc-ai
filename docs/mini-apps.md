# Mini apps

Mini apps are small HTML/JS/CSS apps, built in zdocs' AI builder, that read and update your documents through the **uiTx SDK**. doc-ai runs them but doesn't include the builder: there's no chat, code view, console or version history in the UI. You create and edit apps from an MCP client instead (see [Creating and editing](#creating-and-editing)).

## Using them

- **Apps** (`/apps`, the last entry in the app menu) lists the pinned apps first (drag to reorder the app menu), then every other system app and mini app. Click one to open it. The switch adds it to or removes it from the app menu.
- **`/app/:miniAppId`** runs one app under the header, with refresh, print, fullscreen and close buttons ([MiniAppPage.tsx](../packages/client/src/pages/mini-apps/MiniAppPage.tsx)).

## How an app runs

1. The page loads the app's `code` and renders it with zdocs' [MiniAppViewer.tsx](../packages/client/src/components/ui-tx/MiniAppViewer.tsx) in a sandboxed `srcdoc` iframe, with the theme script injected.
2. The app includes the SDK, `<script src="/sdk/ui-tx/v1.js">`, served from [apps/web/public/sdk/ui-tx](../apps/web/public/sdk/ui-tx) (a built copy of zdocs' `packages/ui-tx`). Apps built in zdocs point at the zdocs host; the page rewrites that URL to the local copy at render time, without changing the stored code.
3. The SDK (`window.zDocs.uiTx`) posts `UITX_REQUEST` messages to the parent window. [useUiTxMessageHandler.ts](../packages/client/src/hooks/useUiTxMessageHandler.ts) handles `ui.*` helpers (toast, confirm, open document/folder) in the browser and forwards data calls to `POST /api/ui-tx`.
4. [/api/ui-tx](../apps/server/src/zdocs-api/ui-tx/route.ts) checks the org and calls [handleUiTxRequest.ts](../packages/srv/src/ui-tx/handleUiTxRequest.ts), which dispatches to the same handlers the MCP tools use: `getSession`, `searchEntities`, `getEntity`, `listDocuments`, `aggregate`, `updateEntityFields`, plus the reconciliation methods `listReconciliationLinks`, `traceReconciliation`, `createReconciliationLink` and `deleteReconciliationLink`.
5. The folder methods `listFolders`, `moveDocuments`, `renameFolder`, `moveFolder` and `deleteFolder` (empty folders only) are answered before the zdocs route by [folders/ui-tx-routes.ts](../apps/server/src/folders/ui-tx-routes.ts), with the same helpers as the MCP folder tools, so directories and files follow in the watch folder. They were added to the SDK bundle by hand (`v1.js`; its source map doesn't cover them).

The iframe runs with `allow-same-origin`, so an app has the same access to the local API as the web UI. Only run apps you trust; see [Security](security.md).

## Creating and editing

The [MCP server](mcp-server.md#mini-apps) has `get_mini_app_guide`, `list_mini_apps`, `get_mini_app`, `create_mini_app` and `update_mini_app` ([mini-apps/mcp-tools.ts](../apps/server/src/mini-apps/mcp-tools.ts)). Ask your MCP client for an app and it reads the guide, explores the data with the search tools, writes the HTML and returns a link to open it. Edits use the same anchor format as zdocs' builder ([applyEdits.ts](../packages/util/src/utils/applyEdits.ts)), and every save is checked with [validateMiniAppCode.ts](../packages/util/src/utils/validateMiniAppCode.ts); invalid code is never saved. Open apps don't reload on their own after an edit: use the viewer's refresh button.

## Storage and API

Apps live in the `mini_apps` table; archiving sets `archived_at`, which hides the app from the Applications page (it moves to the collapsible Archived section) and from the app menu, but it can still be opened at `/app/:id`; every create and update also writes a snapshot to `mini_apps_history` ([data model](data-model.md#supporting)). The copied zdocs routes under `/api/org/:orgId/mini-apps` are `list-miniapps`, `create`, and get (`POST`), update (`PUT`) and delete (`DELETE`) per app. The UI only reads; changes come through the MCP tools or this API.

## Importing apps from zdocs

`export-from-zdocs.cjs` exports the org's `mini_apps` rows along with everything else, and `import-zdocs-export.ts` imports them. To add only the mini apps to a DB that already has your documents, stop the server and run:

```bash
npx tsx --env-file=../../.env scripts/import-zdocs-export.ts <manifest.json> --mini-apps-only
```

from `apps/server`. See [Scripts and migration](scripts.md).
