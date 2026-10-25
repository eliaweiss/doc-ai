# Security

## Trust model

doc-ai is built for **one person on their own machine**.

- The HTTP server binds to `127.0.0.1` only ([main.ts](../apps/server/src/main.ts)). Nothing is reachable from other machines unless you forward the port yourself.
- There is **no authentication** on the UI, the API or MCP. Any process running as any user on the same machine that can reach localhost can read and change your documents. Don't run doc-ai on a shared machine, and don't expose port 4310 through a tunnel or reverse proxy.
- The zdocs auth layer is replaced by a fixed, always-signed-in local user on both server ([next-auth.ts](../apps/server/src/next-compat/next-auth.ts)) and client ([next-auth-react.tsx](../apps/web/src/shims/next-auth-react.tsx)).

## What leaves the machine

- **Document contents go to the AI provider.** With the Gateway provider, every classified or extracted file (images, PDFs, CSV text) is sent to Vercel AI Gateway and on to the model vendor (Google Gemini by default). With Ollama, it goes to your Ollama server.
- **Eye telemetry.** Import from folder sorts photos locally (photos never leave the machine), but the Eye library sends usage telemetry to Desert Ant's license server, and downloads its model on first use.
- **No analytics.** zdocs' user-journey analytics (and its geolocation lookup) are disabled in the client ([logUserJourneyEventApi.ts](../packages/client/src/utilities/api/logUserJourneyEventApi.ts)) and dropped by the server.

## Secrets

- The Gateway key can come from `.env` or from the Settings page. Settings are stored in `settings.json` in the data folder with owner-only permissions ([config.ts](../packages/srv/src/local/config.ts)).
- The settings API never returns the key, only whether it's set, its last four characters and its source ([settings.ts](../apps/server/src/settings.ts)).

## Files

- The watch folder is never modified except to add files you upload or import through the UI. Spreadsheet conversions and caches go to the data folder.
- Document paths are resolved with `resolveDocumentPath` ([paths.ts](../packages/srv/src/local/paths.ts)), which rejects any stored key that would escape the watch folder.
- Uploaded and imported file names are sanitized (path separators and reserved characters replaced) before they're written ([local-routes.ts](../apps/server/src/local-routes.ts)).
- Uploads are limited to 50 MB at the route, and documents to the processing limits in `DOCUMENT_LIMITS`.
- The watch folder and the data folder can't be nested in each other.
- Import from folder reads any folder you point it at (it refuses the disk root and the home folder itself) but only **copies** files; the photo thumbnail route only serves files that appeared in a recent scan, so it can't be used to read arbitrary paths ([scan.ts](../apps/server/src/photo-sort/scan.ts), [routes.ts](../apps/server/src/photo-sort/routes.ts)). The folder browser lists directory names only.

## Code formulas

Document types can contain `code` formula fields: JavaScript that runs after extraction ([formula-service.ts](../packages/srv/src/extraction/formula-service.ts)). In doc-ai this code runs **unsandboxed, with full Node.js access**, in the server process. A malicious schema could read or delete any file your user can, or make network requests.

So:

- Code formulas are **off by default**. They are skipped, with an info notification on the document, unless `DOC_AI_ALLOW_CODE_FORMULAS=true`.
- `create_document_type` over MCP **rejects** any schema that contains code fields ([services.ts](../apps/server/src/services.ts)), because an AI assistant could otherwise be prompted (for example by text inside a document) into creating one. A schema-review step that would let such schemas through safely isn't implemented yet.
- Only enable code formulas for schemas you wrote or reviewed yourself.

## Prompt injection

Document contents are passed to AI models and, through MCP, to your assistant. A document could contain text written to manipulate either. doc-ai's mitigations are the MCP rejection of code formulas and the fact that MCP tools can only read data, correct fields, create code-free schemas, reprocess documents and import files you name. Review what your assistant proposes before approving tool calls, as with any MCP server.
