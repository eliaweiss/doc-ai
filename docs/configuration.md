# Configuration

doc-ai reads configuration from three places, in increasing priority:

1. **Built-in defaults.**
2. **Environment variables**, normally from `.env` at the repository root (loaded by the server's `start` and `dev` scripts in [apps/server/package.json](../apps/server/package.json)). The template is [.env.example](../.env.example).
3. **Settings saved from the UI** in `<data folder>/settings.json`. These override the environment for the values they cover.

The resolution logic is `getConfig()` in [packages/srv/src/local/config.ts](../packages/srv/src/local/config.ts). Model selection per pipeline step lives in the database instead (see below).

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `DOC_AI_WATCH_DIR` | none | Folder to watch, subfolders included. `~` is expanded. If unset (and not set in Settings), the watcher is off. |
| `DOC_AI_DATA_DIR` | `~/.doc-ai` | Data folder: database, caches and `settings.json`. When set, it wins over the Settings page. |
| `DOC_AI_PROVIDER` | `gateway` | `gateway` (Vercel AI Gateway) or `ollama`. |
| `AI_GATEWAY_API_KEY` | none | Gateway API key. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL. |
| `DOC_AI_OLLAMA_MODEL` | `qwen3.5:9b` | Ollama model used for every step. Must be a vision model. |
| `DOC_AI_WORKER_CONCURRENCY` | `2` | How many documents the worker processes in parallel ([worker.ts](../apps/server/src/worker.ts)). |
| `DOC_AI_ALLOW_CODE_FORMULAS` | off | Set to `true` to run `code` formula fields. They run **unsandboxed**; see [Security](security.md). |
| `DOC_AI_DB_IN_MEMORY` | off | Set to `1` to use an in-memory database (useful for tests; nothing is persisted). See [packages/db-schema/src/db.ts](../packages/db-schema/src/db.ts). |
| `DOC_AI_SERVER_URL` | `http://127.0.0.1:4310` | Only for `npm run dev:web`: where Vite proxies `/api` and `/mcp`. |
| `PORT` | `4310` | HTTP port for the UI, API and MCP. Environment only. |

## The Settings page (Settings → Processing)

The Processing section of the settings page ([ProcessingSection.tsx](../packages/client/src/pages/app/org-admin/components/ProcessingSection.tsx)) talks to `GET/POST /api/local/settings` and `POST /api/local/settings/test`, implemented in [apps/server/src/settings.ts](../apps/server/src/settings.ts). It lets you change:

- **Watch folder.** Must be an existing directory. Saving restarts the watcher immediately, without a server restart.
- **Data folder.** Takes effect on the next restart. It can't be changed here if `DOC_AI_DATA_DIR` is set. When it changes, the current `settings.json` is copied into the new folder unless one already exists there. An empty value goes back to `~/.doc-ai`.
- **Provider**: Gateway or Ollama.
- **Gateway API key.** The key is never sent back to the browser; the page only sees whether one is set, its last four characters and whether it came from Settings or `.env`. Saving an empty value keeps the current key; clearing it falls back to `.env`.
- **Ollama URL and model.**
- **Model per step** (Gateway only): one model for classification (`CLASSIFY_DOCUMENT`) and one for extraction (`EXTRACT_DOCUMENT`), chosen from every model that appears in the built-in model map, or typed as `provider/model`.
- **Connection test**: runs one tiny generation with the classification model and reports the reply and the latency.

Validation rules enforced on save:

- The watch folder and the data folder can't be inside each other (otherwise doc-ai would ingest its own caches).
- Model values must look like `provider/model` and refer to a known pipeline action.
- The Ollama URL must parse as a URL.

`settings.json` is written with owner-only permissions (mode 600) because it may hold the API key.

## The data folder

The data folder is resolved once per process by [packages/db-schema/src/data-dir.ts](../packages/db-schema/src/data-dir.ts):

1. `DOC_AI_DATA_DIR` if set,
2. else the folder chosen on the Settings page, stored in a pointer file at the fixed location `~/.doc-ai/data-dir.json` (it can't live in the data folder itself),
3. else `~/.doc-ai`.

Its contents are described in [Data model](data-model.md#files-on-disk).

## Model selection

Model selection is handled by [packages/srv/src/ai/get-model-provider.ts](../packages/srv/src/ai/get-model-provider.ts), a config-driven replacement for zdocs' billing-aware provider lookup:

- **Gateway**: for each pipeline action, the model saved on the Settings page (stored in the `ai_model_settings` table, see [ai-model-settings.ts](../packages/db-schema/src/queries/ai-model-settings.ts)); otherwise the default for that action from the `geminiBuilder` profile of `AI_MODEL_MAP` in [AiModelConfig.ts](../packages/types/src/types/AiModelConfig.ts). Provider-specific options of the default (such as a thinking budget) are kept only if the chosen model is from the same provider.
- **Ollama**: Ollama's OpenAI-compatible `/v1` endpoint, with the one configured model for every action.

The model map also lists actions doc-ai doesn't run (chat, AI builder, category mapping, a "lite" extraction model); only classification and extraction are exposed on the Settings page.

## Pipeline flags inherited from zdocs

The copied pipeline reads a few environment variables of its own. They are not in `.env.example` and are off or at their zdocs defaults unless you set them:

| Variable | Default | Meaning |
|---|---|---|
| `MULTIPAGE_EXTRACTION_SPLIT_ENABLED` | off | Set to `true` to split multi-page PDFs that have line-item collections into pages and extract line items per page in parallel ([extract-visual-document-data.ts](../packages/srv/src/extraction/extract-visual-document-data.ts)). |
| `TRIGGER_MULTIPAGE_EXTRACTION_PAGE_COUNT` | `2` | Minimum page count for the per-page path when it's enabled. |
| `NEXT_PUBLIC_URL` | unset | In zdocs this makes the pipeline dispatch the next step over HTTP. Leave it unset in doc-ai: the in-process worker runs the steps directly. |
