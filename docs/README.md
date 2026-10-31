# doc-ai documentation

doc-ai is a local, single-user document intelligence service. It watches a folder on your machine, classifies every new document with an AI model, extracts structured data (header fields and line-item tables) against a document-type schema, stores the result in an embedded Postgres database, and lets you browse, correct and query that data from a web UI or from any MCP client (Claude Desktop, Cursor, and others).

These pages describe how the project works and where each piece lives. They reference source files instead of reproducing code.

## Contents

| Page | What it covers |
|---|---|
| [Overview](overview.md) | What doc-ai does, the main concepts, and a glossary |
| [Getting started](getting-started.md) | Installing, running, and connecting an MCP client |
| [Setting up DocAI](setup-wizard.md) | The first-run setup wizard, step by step, with screenshots |
| [Configuration](configuration.md) | Environment variables, the Settings page, the data folder, model selection |
| [Architecture](architecture.md) | The single-process design, the HTTP surface, and the repository layout |
| [Ingestion](ingestion.md) | How files enter the system: the folder watcher, UI uploads, dedupe, renames, spreadsheets |
| [Processing pipeline](processing-pipeline.md) | The queue, the worker, classification, extraction, formulas, indexing and statuses |
| [Document types](document-types.md) | Schemas, field types, line-item collections, system types, formulas |
| [Data model](data-model.md) | The PGlite database, the tables, the caches and the files on disk |
| [Search and querying](search.md) | The search index, entities, filters and aggregation |
| [MCP server](mcp-server.md) | Every MCP tool, what it does and how it maps to internal code |
| [HTTP API](http-api.md) | Local routes, the copied zdocs routes, and the compatibility layer |
| [Web UI](web-ui.md) | The Vite shell, routes, Next.js shims and what was hidden |
| [Mini apps](mini-apps.md) | Running zdocs mini apps: the viewer, the uiTx bridge, storage and import |
| [Import from folder (Eye)](import-from-folder.md) | On-device photo sorting and the import picker |
| [Relationship to zdocs](zdocs-reuse.md) | Which code was copied, what changed, and why |
| [Security](security.md) | The trust model, code formulas, and file-access rules |
| [Scripts and migration](scripts.md) | Exporting from zdocs, importing into doc-ai, DB migrations |
| [Limitations and roadmap](limitations.md) | Known gaps and planned work |

The top-level [README](../README.md) is a shorter summary of the same material.
