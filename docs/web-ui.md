# Web UI

The UI is the zdocs React client running on Vite and react-router instead of Next.js. It's served by the doc-ai server at `http://localhost:4310`.

## Structure

| Piece | Location |
|---|---|
| Shell: entry point, providers, router | [apps/web/src/main.tsx](../apps/web/src/main.tsx) |
| Route components (ported from zdocs' `page.tsx` wrappers) | [apps/web/src/routes.tsx](../apps/web/src/routes.tsx) |
| Next.js shims | [apps/web/src/shims](../apps/web/src/shims) |
| Build config and aliases | [apps/web/vite.config.ts](../apps/web/vite.config.ts) |
| Styling | [globals.css](../apps/web/src/globals.css), [tailwind.config.ts](../apps/web/tailwind.config.ts), [postcss.config.js](../apps/web/postcss.config.js), [components.json](../apps/web/components.json) |
| Pages, stores, providers, API helpers | [packages/client/src](../packages/client/src) |
| UI primitives and AI chat elements | [packages/client-component/src](../packages/client-component/src) |
| Translations (English, Hebrew) | [packages/client/src/context-providers/messages](../packages/client/src/context-providers/messages) |

The main shell wraps the app in toasts, the zdocs app context and a locale provider (English by default).

## Routes

| Path | Page | Source |
|---|---|---|
| `/` | Redirects to `/folder` | |
| `/folder`, `/folder/:folderId` | **Drive**: folder tree, document grid or cards, upload, new folder, import from folder, move/rename/delete, drag-and-drop anywhere | [pages/drive](../packages/client/src/pages/drive), via [BrowsePage.tsx](../packages/client/src/pages/apps/BrowsePage.tsx) |
| `/document/:documentId` | **Document viewer**: file preview on one side, extracted data on the other, editable header fields, line-item grids (add and remove rows, mark duplicates), notification banner, change type, re-extract | [pages/document](../packages/client/src/pages/document) |
| `/schema` | **Extraction Templates**: browse, create, edit, import/export document types and their fields, formulas and folder mappings | [pages/schema](../packages/client/src/pages/schema) |
| `/search` | **Search**: free-text and filtered entity search, result tabs per schema type, grid and graph views, date shortcuts, saved queries | [pages/search](../packages/client/src/pages/search) |
| `/apps` | **Apps**: the apps pinned to the app menu (drag to reorder, switch off to remove), then the system apps and [mini apps](mini-apps.md) not yet pinned, each with a switch to add it | [pages/mini-apps](../packages/client/src/pages/mini-apps) |
| `/app/:miniAppId` | **Mini app**: runs one app, view only | [MiniAppPage.tsx](../packages/client/src/pages/mini-apps/MiniAppPage.tsx) |
| `/reconciliation/workbench` | **Reconciliation**: match transactions across documents (for example card statement lines to receipts), auto-reconcile, suggested pairs and duplicates, saved sessions, CSV export | [pages/reconciliation](../packages/client/src/pages/reconciliation) |
| `/settings` | **Settings**: general preferences and the Processing section (watch folder, data folder, provider, key, models, connection test) | [pages/app/org-admin](../packages/client/src/pages/app/org-admin) |
| anything else | Redirects to `/folder` | |

`?showUpload=true` on a drive route opens the upload dialog.

The app switcher in the header shows **Files & Folders**, **Extraction Templates** and **Settings** ([systemApps.ts](../packages/client/src/pages/app/utils/systemApps.ts)), any pinned mini apps, and the Applications entry at the bottom.

## State

The client uses Zustand stores and React context providers in [packages/client/src/context-providers](../packages/client/src/context-providers): documents and folders ([docsStore.ts](../packages/client/src/context-providers/docsStore.ts)), the document view ([documentViewStore.ts](../packages/client/src/context-providers/documentViewStore.ts)), search ([searchStore.ts](../packages/client/src/context-providers/searchStore.ts)), uploads ([uploadStore.ts](../packages/client/src/context-providers/uploadStore.ts)), the organization ([orgStore.tsx](../packages/client/src/context-providers/orgStore.tsx)), quick access, locale and confirm dialogs. API calls are thin helpers in [packages/client/src/utilities/api](../packages/client/src/utilities/api) that hit the routes described in [HTTP API](http-api.md).

## Running zdocs' Next.js client on Vite

The client files were written for Next.js. Rather than edit them, the Vite config redirects Next imports to small shims:

| Import | Shim | Behaviour |
|---|---|---|
| `next/navigation` | [next-navigation.ts](../apps/web/src/shims/next-navigation.ts) | `useRouter`, `usePathname`, `useSearchParams`, `useParams` on top of react-router |
| `next/link` | [next-link.tsx](../apps/web/src/shims/next-link.tsx) | react-router `Link` |
| `next/image` | [next-image.tsx](../apps/web/src/shims/next-image.tsx) | A plain `img` |
| `next-auth/react` | [next-auth-react.tsx](../apps/web/src/shims/next-auth-react.tsx) | Always signed in as the local user |
| `next-auth` | [next-auth.ts](../apps/web/src/shims/next-auth.ts) | Types only |
| `next-intl` | [next-intl.tsx](../apps/web/src/shims/next-intl.tsx) | `use-intl`, which has the same hooks |

Other build details from [vite.config.ts](../apps/web/vite.config.ts):

- Pages are imported **by deep path** (`@zdocs/client/src/...`) instead of through the package's barrel file. The barrel would pull in every zdocs feature; deep imports keep unported features (billing, ledger trace, integrations, tasks, AI builder) out of the bundle unless a kept page imports them.
- `NEXT_PUBLIC_*` values the client reads are fixed at build time: app name `doc-ai`, empty URLs, and the dataset, bank-link, QuickBooks and Xero features turned off.
- The dev server runs on port 4311 and proxies `/api` and `/mcp` to the doc-ai server.

## Edits to the copied client

The client is copied from zdocs with a small number of edits, each marked with a `doc-ai:` comment so they're easy to find and re-apply after syncing with zdocs. They:

- remove the organization switcher, user menu, org colours and create-organization dialogs ([AppHeader.tsx](../packages/client/src/pages/app/AppHeader.tsx), [UserMenu.tsx](../packages/client/src/components/UserMenu.tsx)),
- replace billing and invoice history in Settings with the local **Processing** section ([ProcessingSection.tsx](../packages/client/src/pages/app/org-admin/components/ProcessingSection.tsx), [OrganizationSettingsSidebar.tsx](../packages/client/src/pages/app/org-admin/components/OrganizationSettingsSidebar.tsx), [OrganizationSettingsContent.tsx](../packages/client/src/pages/app/org-admin/components/OrganizationSettingsContent.tsx)),
- hide sharing, organization name/colour and inbound API/webhook settings ([BasicInfoSection.tsx](../packages/client/src/pages/app/org-admin/components/BasicInfoSection.tsx), [OrganizationApiSettingsContent.tsx](../packages/client/src/pages/app/org-admin/components/OrganizationApiSettingsContent.tsx), [systemApps.ts](../packages/client/src/pages/app/utils/systemApps.ts)),
- point the "Applications" quick-access entry at `/apps` instead of `/home` ([QuickAccessProvider.tsx](../packages/client/src/context-providers/QuickAccessProvider.tsx)),
- open mini apps at `/app/:id` instead of the AI builder ([types.ts](../packages/client/src/pages/app/components/types.ts), [QuickAccessBar.tsx](../packages/client/src/pages/app/components/QuickAccessBar.tsx), [AppSelector.tsx](../packages/client/src/pages/app/components/AppSelector.tsx)),
- disable analytics, including a geolocation lookup ([logUserJourneyEventApi.ts](../packages/client/src/utilities/api/logUserJourneyEventApi.ts)),
- add **New → Import from Folder** ([NewItemMenu.tsx](../packages/client/src/pages/drive/components/NewItemMenu.tsx), [ImportFromFolderModal.tsx](../packages/client/src/pages/drive/components/ImportFromFolderModal.tsx)).

## Known UI caveats

- The document viewer calls QuickBooks and Xero status endpoints; they return 404 and the client treats that as "not connected".
- The production bundle is large (about 4.4 MB) because chat and markdown components pull in shiki and mermaid.
- "Schema from sample" needs a local replacement for its S3 upload and doesn't work yet.
