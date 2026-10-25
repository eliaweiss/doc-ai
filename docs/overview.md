# Overview

## What doc-ai does

doc-ai turns a folder of business documents (invoices, receipts, bank and credit-card statements, payslips, tax forms, contracts, spreadsheets and so on) into a queryable database, entirely on your machine except for the AI model calls.

The typical flow:

1. You point doc-ai at a folder, for example a Google Drive folder synced in "mirror files" mode.
2. Every supported file that appears in that folder (or its subfolders) becomes a **document**.
3. The document is **classified**: an AI vision model decides which **document type** it is (for example `INVOICE`) and pulls out a title, a main amount and a main date.
4. The document is **extracted**: the model fills in every field of that type's schema, including tables of line items (invoice lines, bank transactions, and so on).
5. **Formulas** run over the extracted data (sums, validations).
6. The result is **indexed** for search.
7. You browse and correct the data in the web UI, or ask questions from an MCP client ("how much did I spend on toner last quarter?").

doc-ai is the open-source, local edition of zdocs, a hosted multi-tenant product. Most of its code is copied from zdocs unchanged; doc-ai replaces the cloud infrastructure (S3, Lambda, Neon Postgres, Next.js, auth, billing) with local equivalents. See [Relationship to zdocs](zdocs-reuse.md).

## Design goals

- **Local and single-user.** One Node process, one embedded database, bound to `127.0.0.1`, no login.
- **Never modify your files.** The watched folder is read-only for doc-ai, except when you upload or import through the UI, which writes new files into it. Derived files (spreadsheets converted to CSV, AI response caches) go to the data folder.
- **Reuse, don't rewrite.** The zdocs pipeline, query layer, client and API handlers are kept as close to the original as possible so improvements can flow between the two.
- **Agent-first querying.** The MCP server exposes the same search, aggregation and update operations that zdocs built for its in-app AI agent.

## Key concepts

| Term | Meaning |
|---|---|
| **Watch folder** | The folder doc-ai watches for documents. Set by `DOC_AI_WATCH_DIR` or the Settings page. |
| **Data folder** | Where doc-ai keeps its database, caches and settings. Defaults to `~/.doc-ai`. |
| **Document** | One file, identified by its content hash (MD5). A row in the `documents` table. |
| **Document type** (schema, extraction template) | A named schema such as `INVOICE`: header fields, line-item collections, formulas, an extraction hint. Defined in [system-schemas.ts](../packages/types/src/schemas/system-schemas.ts) for built-in types; custom types are created in the UI or over MCP. |
| **Header fields** | The single-valued fields of a document (vendor, date, total, …). |
| **Line-item collection** | A named table inside a document type (for example invoice `lineItems`, bank-statement `transactions`). |
| **Document data** | The extracted values for one document: header data plus line-item collections. A row in `document_data`. |
| **Entity** | A searchable unit: either a document **header** or a single **line item**. Line-item entity IDs look like `documentId_collectionKey_index`. |
| **Schema type** | The kind of entity, written as `<DOCTYPE>_header` or `<DOCTYPE>_<collectionKey>`, for example `INVOICE_header` or `BANK_STATEMENT_transactions`. |
| **Queue job** | A row in `ai_processing_queue` that tells the worker to classify and/or extract a document. |
| **Folder (UI folder)** | A virtual folder in the doc-ai drive. The root folder ("Documents") maps to the watch folder; UI folders used for uploads map to subfolders of it. |
| **Local org** | zdocs is multi-tenant; doc-ai uses a single fixed organization with id `local` and user `local-user`, so the org-scoped zdocs queries work unchanged. |

## Supported files

- Ingested by the watcher and uploads: PDF, JPG/JPEG/JFIF, PNG, GIF, WebP, TIFF, CSV, XLS, XLSX, XLSM. The list is in [watcher.ts](../apps/server/src/watcher.ts).
- Import from folder (Eye) only handles photos for now: JPG, PNG, WebP, GIF, TIFF. See [Import from folder](import-from-folder.md).
- Size limits come from `DOCUMENT_LIMITS` in [packages/types/src/types/index.ts](../packages/types/src/types/index.ts): 10 MB per file, a stricter limit for large multi-page files, at most 15 PDF pages, and text documents trimmed to a line limit before classification.

## Ways to use it

- **Web UI** at `http://localhost:4310`: drive (folders and files), document viewer with editable fields, schema editor, search, settings. See [Web UI](web-ui.md).
- **MCP** at `http://localhost:4310/mcp`: tools for status, schemas, documents, search, aggregation, corrections, reprocessing and photo import. See [MCP server](mcp-server.md).
- **Local HTTP API** under `/api/local`: status, documents, settings, uploads, photo sorting. See [HTTP API](http-api.md).
