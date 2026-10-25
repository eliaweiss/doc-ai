# Processing pipeline

Every document goes through two AI steps, classification and extraction, followed by formula evaluation and search indexing. The steps are zdocs' pipeline functions, copied unchanged into [packages/srv/src/pipeline](../packages/srv/src/pipeline). doc-ai only changes how they're scheduled.

## The queue

Work is tracked in the `ai_processing_queue` table ([schemas/ai.ts](../packages/db-schema/src/schemas/ai.ts), queries in [queries/queue.ts](../packages/db-schema/src/queries/queue.ts)). Each job belongs to one document and has:

- an **action**: `CLASSIFY` (classify, then extract) or `EXTRACT` (extract only). Defined in [Queue.ts](../packages/types/src/types/Queue.ts).
- a **status**: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMEOUT`, `CANCELLED`, `KEY_ERROR`, or `INSUFFICIENT_CREDITS` (a zdocs billing state that doc-ai never produces).
- attempt counters (`attempts`, `maxAttempts`, default 3), a priority and a `retryAfter` time.

Jobs are created by ingestion (`CLASSIFY`), by reprocessing from the UI or MCP (`CLASSIFY`), and by the extract route used by the document viewer.

## The worker

[apps/server/src/worker.ts](../apps/server/src/worker.ts) replaces zdocs' cron + HTTP dispatch + Lambda setup with one in-process loop:

- Every 5 seconds, or right away when kicked, it claims up to `DOC_AI_WORKER_CONCURRENCY` minus the running count. `claimPendingJobs` picks `PENDING` and `KEY_ERROR` jobs whose `retryAfter` has passed, highest priority first, then oldest, and marks them `IN_PROGRESS`.
- For each job: if the document no longer exists, the job is cancelled. A `CLASSIFY` job runs `classifyDocument` and, if that succeeds, `extractDocument`. An `EXTRACT` job runs `extractDocument` only.
- On start, `cleanupStuckJobs` resets all `IN_PROGRESS` jobs, because in a single process they can only be left over from a crash or restart.
- zdocs' retry scheduler is a no-op here ([task-scheduler.ts](../packages/srv/src/services/task-scheduler.ts)): retries are simply picked up by the next tick.

## Document statuses

A document's `extractionStatus` ([Document.ts](../packages/types/src/types/Document.ts)) moves through:

| Status | Meaning |
|---|---|
| `PENDING` | Ingested, not processed yet |
| `PARTIAL` | Classified; `document_data` exists with the title, amount and date |
| `EXTRACTED` | Full extraction done |
| `INDEXED` | Search index updated; processing finished |
| `RETRYING` | A step failed and will be retried |
| `FAILED` | Failed permanently (or rejected, for example too large); `extractionErrors` holds the message and the stage |
| `KEY_ERROR` | The AI provider rejected the API key; retried until the key is fixed |

Status counts per state are returned by the `get_status` MCP tool and `GET /api/local/status`.

## Step 1: classification

[classify-document.ts](../packages/srv/src/pipeline/classify-document.ts), using [classification-service.ts](../packages/srv/src/extraction/classification-service.ts):

1. Loads the document and its file bytes (through the storage layer described in [Ingestion](ingestion.md#how-documents-point-at-files)).
2. For PDFs, counts and stores the page count.
3. Trims text documents (CSV) to the configured line limit.
4. Loads every document type except datasets.
5. Sends the file itself (image, PDF, or text) to the classification model with a prompt listing the available types. The model returns the type name, a short title, the main amount and the main date (`YYYY-MM-DD`).
6. The response is cached under `cache/classification/<content hash>/<prompt hash>.json`, so reprocessing the same file with the same set of types costs nothing.
7. Writes the partial `document_data` (title, total amount, document date) and sets the document's `docType`, description and date. Status becomes `PARTIAL`.
8. If the document has no folder yet, moves it to the type's default folder, or to the root folder.
9. Switches the job's action to `EXTRACT`.

## Step 2: extraction

[extract-document.ts](../packages/srv/src/pipeline/extract-document.ts), using the services in [packages/srv/src/extraction](../packages/srv/src/extraction):

1. **Extract with AI** ([extract-document-data.ts](../packages/srv/src/extraction/extract-document-data.ts)). The prompt and the response schema are built from the document type ([prompt-builders.ts](../packages/srv/src/extraction/prompt-builders.ts), [response-schema-builders.ts](../packages/srv/src/extraction/response-schema-builders.ts), [zod-schema-builder.ts](../packages/srv/src/extraction/zod-schema-builder.ts)). Only AI-extractable fields are asked for; formula fields are computed later. The result is cached under `cache/extraction/<content hash>/<schema hash>/`, where the schema hash covers the type definition, the model and the category list, so a schema edit or a model change invalidates the cache automatically.
   - **Images and PDFs** go to the vision path ([extract-visual-document-data.ts](../packages/srv/src/extraction/extract-visual-document-data.ts)). The file is sent as-is; PDFs are sent natively. If `MULTIPAGE_EXTRACTION_SPLIT_ENABLED` is on and the PDF has enough pages and the type has line-item collections, the multi-page path splits the PDF into single pages ([pdf-page-split.ts](../packages/srv/src/extraction/pdf-page-split.ts)) and extracts the header and per-page line items in parallel ([extract-multi-page-document-data.ts](../packages/srv/src/extraction/extract-multi-page-document-data.ts), [extract-page-line-items.ts](../packages/srv/src/extraction/extract-page-line-items.ts)), caching each page.
   - **CSV and converted spreadsheets** go to the text path ([extract-text-document-data.ts](../packages/srv/src/extraction/extract-text-document-data.ts)). Large row tables are cut into "virtual pages" with the header row repeated ([split-csv-virtual-pages.ts](../packages/srv/src/extraction/helpers/split-csv-virtual-pages.ts)) and extracted in multiple passes ([extract-multi-pass-text-document-data.ts](../packages/srv/src/extraction/extract-multi-pass-text-document-data.ts)).
2. **Clean up values.** Model output is normalized before validation: placeholder strings like `"null"`, `"N/A"` or `"-"` become real nulls, and numbers or booleans given as strings are converted according to the field's type ([coerceAiFieldValue.ts](../packages/srv/src/extraction/coerceAiFieldValue.ts), [data-cleaning.ts](../packages/srv/src/extraction/data-cleaning.ts)).
3. **Folder mapping.** If the document type defines folder mappings, the model also picks a target folder, and the document is moved there ([folder-context.ts](../packages/srv/src/extraction/folder-context.ts)).
4. **Denormalized values.** Fields marked to be denormalized (as the document's total amount, date, and so on) are copied to the document and `document_data` columns that lists and search use.
5. **Save** the extracted data before formulas run.
6. **Formulas** ([formula-service.ts](../packages/srv/src/extraction/formula-service.ts)): `sum` fields first, then `code` fields. Code fields are skipped with an info notification unless `DOC_AI_ALLOW_CODE_FORMULAS=true`. See [Document types](document-types.md#formula-fields).
7. **Notifications** ([notification-service.ts](../packages/srv/src/extraction/notification-service.ts)): messages produced by formulas (for example "the line items don't add up to the total"). Info-level ones are stored only in `document_data`; warnings and errors also go to the `notifications` table and show up in the UI's notification bell and on the document.
8. **Recompute denormalized values** (sum fields can feed them), save `document_data`, and set the status to `EXTRACTED`.
9. **Index** the document into `search_index` (`indexDocument` in [queries/documents.ts](../packages/db-schema/src/queries/documents.ts)); see [Search](search.md). Status becomes `INDEXED`.
10. **Complete** the job.

## Errors and retries

Handled inside the pipeline functions and [queue.ts](../packages/db-schema/src/queries/queue.ts):

- **API key errors** are detected from provider error messages ([detect-api-key-error.ts](../packages/srv/src/ai/detect-api-key-error.ts)). The document and job go to `KEY_ERROR` and are retried on every worker tick until the key works. (There is no backoff yet; see [Limitations](limitations.md).)
- **Other errors** increment the job's attempt count. Below `maxAttempts` the job goes back to `PENDING` with exponential backoff (a longer base for rate-limit errors such as HTTP 429 or "quota", and a provider-suggested delay when there is one), and the document shows `RETRYING`. After the last attempt both become `FAILED`.
- A missing document cancels the job.

## AI usage logging

Every model call is logged to `ai_usage_logs` with token counts and a cost estimate ([ai-usage-service.ts](../packages/srv/src/ai/ai-usage-service.ts), prices in [ai-pricing.ts](../packages/srv/src/extraction/ai-pricing.ts)). zdocs deducted credits at this point; doc-ai only logs. Logging failures never fail a pipeline step.

## Reprocessing

`reprocessDocument` in [apps/server/src/services.ts](../apps/server/src/services.ts) resets the document to `PENDING`, clears its errors and queues a new `CLASSIFY` job (unless one is already active). It's available as the `reprocess_document` MCP tool, `POST /api/local/documents/:id/reprocess`, and the extract action in the document viewer. Thanks to the caches, reprocessing an unchanged file with an unchanged schema doesn't call the model again.
