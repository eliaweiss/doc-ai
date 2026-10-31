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
| `DOC_AI_PROVIDER` | `gateway` | `ollama`, `local` (built-in model), `gateway` (Vercel AI Gateway), `openrouter`, `openai`, `anthropic` or `google`. Normally chosen in the setup wizard instead. |
| `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | none | API key for that provider, used when none is saved in Settings. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL. |
| `DOC_AI_OLLAMA_MODEL` | `qwen3.5:9b` | Ollama model used for every step. Must be a vision model. |
| `DOC_AI_WORKER_CONCURRENCY` | `2` | How many documents the worker processes in parallel ([worker.ts](../apps/server/src/worker.ts)). |
| `DOC_AI_ALLOW_CODE_FORMULAS` | off | Set to `true` to run `code` formula fields. They run **unsandboxed**; see [Security](security.md). |
| `DOC_AI_DB_IN_MEMORY` | off | Set to `1` to use an in-memory database (useful for tests; nothing is persisted). See [packages/db-schema/src/db.ts](../packages/db-schema/src/db.ts). |
| `DOC_AI_SERVER_URL` | `http://127.0.0.1:4310` | Only for `npm run dev:web`: where Vite proxies `/api` and `/mcp`. |
| `PORT` | `4310` | HTTP port for the UI, API and MCP. Environment only. |

## The Settings page (Settings → Processing)

The Processing section of the settings page ([ProcessingSection.tsx](../packages/client/src/pages/app/org-admin/components/ProcessingSection.tsx)) talks to `GET/POST /api/local/settings` and `POST /api/local/settings/test`, implemented in [apps/server/src/settings.ts](../apps/server/src/settings.ts). It lets you change:

- **Watch folder.** Chosen with **Choose…**, which opens the native folder dialog on the machine running doc-ai (`POST /api/local/settings/pick-folder`: `osascript` on macOS, `zenity` on Linux). Where no dialog is available, the path can be typed instead. Each watch folder has its own workspace (database, caches, trash; see [Data model](data-model.md#files-on-disk)). Saving a different folder switches workspaces right away, without a server restart: the watcher and worker stop (running jobs finish first), that folder's database is opened, and both start again. Switching back to a folder brings back its data. A folder used for the first time starts with the models chosen so far.
- **Data folder.** Takes effect on the next restart. It can't be changed here if `DOC_AI_DATA_DIR` is set. When it changes, the current `settings.json` is copied into the new folder unless one already exists there. An empty value goes back to `~/.doc-ai`.
- **AI provider**, through the setup wizard (see below).
- **Connection test**: runs one tiny generation with the classification model and reports the reply and the latency.

Validation rules enforced on save:

- The watch folder and the data folder can't be inside each other (otherwise doc-ai would ingest its own caches).
- Gateway model values must look like `provider/model` and refer to a known pipeline action; cloud providers need both a classification and an extraction model.
- The Ollama URL must parse as a URL.

`settings.json` is written with owner-only permissions (mode 600) because it may hold API keys. Keys are never sent back to the browser; the page only sees whether one is set, its last four characters and whether it came from Settings or `.env`.

## The AI setup wizard

[AiSetupWizard.tsx](../packages/client/src/pages/app/org-admin/components/AiSetupWizard.tsx) opens on first run (no provider chosen, no gateway key; [SetupGate.tsx](../apps/web/src/SetupGate.tsx)), starting with the watch folder, and from **Change AI provider** in Settings → Processing. Its backend is [apps/server/src/ai-setup.ts](../apps/server/src/ai-setup.ts) (routes under `/api/local/settings/ai/`). The setups:

- **Ollama**: checks the URL (`/api/version`, `/api/tags`) and, if the model is missing, pulls it through Ollama's `/api/pull` with progress.
- **Built-in local model**: downloads a pinned llama.cpp release (`llama-server` for this OS) and Qwen 3.5 9B (Q4_K_M GGUF plus its vision projector, about 6.6 GB) from Hugging Face into `<data dir>/models/`, resuming interrupted downloads ([local-model.ts](../packages/srv/src/local/local-model.ts)). doc-ai starts `llama-server` on a free localhost port the first time a document needs it and stops it when another provider is chosen.
- **OpenAI, Claude, Gemini, OpenRouter**: an API key and two models (classification, extraction). **Check key** lists the models the key can use, which also validates it. Defaults are in [providers.ts](../packages/srv/src/ai/providers.ts).
- **Vercel AI Gateway**: an API key and the model per step, as before.

The last step sends a test request with the unsaved choices; **Finish** saves them (`setupDone` in `settings.json`).

## The data folder

The data folder is resolved once per process by [packages/db-schema/src/data-dir.ts](../packages/db-schema/src/data-dir.ts):

1. `DOC_AI_DATA_DIR` if set,
2. else the folder chosen on the Settings page, stored in a pointer file at the fixed location `~/.doc-ai/data-dir.json` (it can't live in the data folder itself),
3. else `~/.doc-ai`.

Its contents are described in [Data model](data-model.md#files-on-disk).

## Model selection

Model selection is handled by [packages/srv/src/ai/get-model-provider.ts](../packages/srv/src/ai/get-model-provider.ts), a config-driven replacement for zdocs' billing-aware provider lookup:

- **Gateway**: for each pipeline action, the model saved on the Settings page (stored in the `ai_model_settings` table, see [ai-model-settings.ts](../packages/db-schema/src/queries/ai-model-settings.ts)); otherwise the default for that action from the `geminiBuilder` profile of `AI_MODEL_MAP` in [AiModelConfig.ts](../packages/types/src/types/AiModelConfig.ts). Provider-specific options of the default (such as a thinking budget) are kept only if the chosen model is from the same provider.
- **Ollama**: [ollama-ai-provider-v2](https://github.com/nordwestt/ollama-ai-provider-v2), with the one configured model for every action and thinking turned off.
- **Built-in local model**: `@ai-sdk/openai-compatible` on the `llama-server` doc-ai runs.
- **OpenRouter, OpenAI, Claude, Gemini**: `@openrouter/ai-sdk-provider`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`. Classification, "lite" extraction and category mapping use the classification model; everything else uses the extraction model.

Local models only read images, so for Ollama and the built-in model each PDF is rendered to one PNG per page (pdf.js with `@napi-rs/canvas`, at most 8 pages) by [pdf-to-images.ts](../packages/srv/src/ai/pdf-to-images.ts). The cloud providers get PDFs as files.

The model map also lists actions doc-ai doesn't run (chat, AI builder, category mapping, a "lite" extraction model); only classification and extraction are exposed on the Settings page.

## Pipeline flags inherited from zdocs

The copied pipeline reads a few environment variables of its own. They are not in `.env.example` and are off or at their zdocs defaults unless you set them:

| Variable | Default | Meaning |
|---|---|---|
| `MULTIPAGE_EXTRACTION_SPLIT_ENABLED` | off | Set to `true` to split multi-page PDFs that have line-item collections into pages and extract line items per page in parallel ([extract-visual-document-data.ts](../packages/srv/src/extraction/extract-visual-document-data.ts)). |
| `TRIGGER_MULTIPAGE_EXTRACTION_PAGE_COUNT` | `2` | Minimum page count for the per-page path when it's enabled. |
| `NEXT_PUBLIC_URL` | unset | In zdocs this makes the pipeline dispatch the next step over HTTP. Leave it unset in doc-ai: the in-process worker runs the steps directly. |
