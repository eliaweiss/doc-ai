# Ingestion

Files enter doc-ai in three ways. All three end in the same function, `finishIngest` in [apps/server/src/watcher.ts](../apps/server/src/watcher.ts), which mirrors zdocs' upload-complete route.

## 1. The folder watcher

[watcher.ts](../apps/server/src/watcher.ts) uses chokidar to watch the watch folder and all its subfolders.

**What it watches**

- On start it reports every existing file (initial scan), so files added while the server was down are picked up.
- It reacts to `add` and `change` events. `unlink` (deletion) is only logged; the document is kept.
- It waits for a file to be stable (no size change for 2 seconds) before reading it. This matters for sync clients such as Google Drive "mirror files", which write in chunks.
- It ignores hidden files, Office lock files (`~$…`), and temporary or placeholder files from browsers and sync clients (`.tmp`, `.part`, `.crdownload`, `.download`, and Google Docs/Sheets/Slides shortcut files).
- It ignores the doc-ai cache folder in case it sits inside the watch folder (the Settings page prevents that configuration anyway).
- Only supported extensions are ingested: `pdf`, `jpg`, `jpeg`, `jfif`, `png`, `gif`, `webp`, `tiff`, `tif`, `csv`, `xls`, `xlsx`, `xlsm`. Empty files are skipped.

**What it does with a file**

1. Reads the file and computes its MD5 hash.
2. **Same content already known** (lookup by hash, `findDocumentByContentHashForOrg` in [local.ts](../packages/db-schema/src/queries/local.ts)): if the path differs from the stored one, this is treated as a rename or move inside the folder. The document's path, file name and `sourcePath` metadata are updated; nothing is reprocessed. If the path is the same, nothing happens.
3. **Same path, new content** (the file was edited in place): v1 keeps the old document and creates a new one. See [Limitations](limitations.md).
4. Otherwise a new `documents` row is created in the root folder, with the path relative to the watch folder stored as its storage key, the bucket set to `local`, and `metadata.sourcePath` set to the relative path.
5. `finishIngest` runs (below).

Ingestion is serialized through a promise chain so that hash checks never race each other.

The watcher is restarted live when the watch folder changes on the Settings page (`restartWatcher` in [main.ts](../apps/server/src/main.ts)).

## 2. Uploads from the web UI

The zdocs client uploads in three steps (presign, PUT, complete). doc-ai keeps that contract but stores files locally. The routes are in [apps/server/src/local-routes.ts](../apps/server/src/local-routes.ts); the client side is [handleClientUpload.ts](../packages/client/src/utilities/handleClientUpload.ts) and [uploadStore.ts](../packages/client/src/context-providers/uploadStore.ts).

1. **Presign** (`POST /api/uploads/aws`): the client sends the file's MD5, name, size, type and target UI folder. The server rejects files over 50 MB or with unsupported extensions. If the hash is already known, it returns the existing document and no upload URL. Otherwise it picks a free path in the watch folder (the root folder maps to the watch folder itself; any other UI folder maps to a subfolder with the folder's name; name clashes get ` (1)`, ` (2)`, …), creates the document row in the chosen UI folder and returns a local upload URL.
2. **Upload** (`PUT /api/uploads/local/:id`): writes the bytes to that path in the watch folder.
3. **Complete** (`POST /api/uploads/:id/complete`): runs `finishIngest`.

Because the row already exists with the file's hash when the watcher sees the new file, the watcher recognizes it and does nothing.

There is also a simpler `POST /api/local/upload` (multipart) in [api.ts](../apps/server/src/api.ts) that just writes the files into the watch folder root and lets the watcher do the rest.

## 3. Import from folder

Photos picked from another folder (in the UI or over MCP) are copied into the watch folder and ingested the same way as UI uploads. See [Import from folder](import-from-folder.md). The source folder is never modified.

## finishIngest

Shared by all three paths:

1. **Size check** against `DOCUMENT_LIMITS` ([file-size-limits.ts](../packages/srv/src/storage/file-size-limits.ts)). A file that is too large is marked upload-complete and immediately `FAILED` with the reason, at the classification stage.
2. Marks the document **upload complete**.
3. **Spreadsheet conversion.** Binary spreadsheets (XLS, XLSX, XLSM) are converted to CSV text, one section per sheet ([dataset-to-text.ts](../packages/srv/src/extraction/dataset-to-text.ts)). The CSV is written to the cache (`cache/converted/<hash>.csv`), never to your folder, and the document is repointed at it (bucket `cache`, type `text/csv`). CSV files are kept as they are. A conversion failure is logged and the original file is processed instead.
4. **Queues a `CLASSIFY` job** unless the document already has an active one, and kicks the worker.

## How documents point at files

zdocs stored documents in S3, so the document row has `s3Bucket` and `s3Key` columns. doc-ai keeps the columns and reinterprets them ([s3-cache.ts](../packages/srv/src/extraction/s3-cache.ts)):

| `s3Bucket` | `s3Key` means | Lives in |
|---|---|---|
| `local` | Path relative to the watch folder | The watch folder |
| `cache` | Path relative to the cache folder | `<data folder>/cache` |

Paths are resolved with `resolveDocumentPath` ([paths.ts](../packages/srv/src/local/paths.ts)), which refuses any key that would escape the watch folder. The original path is also kept in `metadata.sourcePath`, which the preview endpoint prefers, so a converted spreadsheet still previews as the original file.
