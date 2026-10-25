# Import from folder (Eye)

Import from folder finds the receipts and documents among a folder of photos (for example a phone's camera roll export) and imports only those into doc-ai. Sorting runs entirely on your machine.

## Using it

**In the UI**: open **New → Import from Folder** in the drive ([ImportFromFolderModal.tsx](../packages/client/src/pages/drive/components/ImportFromFolderModal.tsx)). Type a path or browse to a folder and click **Scan**. When the scan finishes, every receipt and document found is selected, except ones already in doc-ai. Unselect what you don't want, pick a doc-ai folder, and click **Import**. The last folder you scanned is remembered in the browser.

**From an MCP client**: ask something like "find the receipts in ~/Pictures/2025 and import them". The assistant calls `find_documents_in_folder`; hosts that support MCP Apps show an inline picker with thumbnails, select/unselect all and an Import button. The assistant can also import directly with `import_photos`. See [MCP server](mcp-server.md#import-from-folder).

In both cases the source folder is never changed: files are copied.

## How sorting works

The classifier is [Eye](https://desertant.com/models/eye/) from Desert Ant Labs, the model behind eye-photo-sorter. doc-ai runs it in the server process through its **native Node core** (Core ML on macOS, LiteRT on Linux), wrapped by [apps/server/src/photo-sort/eye.ts](../apps/server/src/photo-sort/eye.ts).

- **Model loading.** The model is loaded once per process and reused. The first load downloads it into `<data folder>/cache/eye` (about 35 seconds); after that it loads in under 100 ms. A failed load is retried on the next call.
- **Per photo.** The photo is decoded with sharp, rotated upright from its EXIF orientation, scaled to at most 1024 px on the long side, and passed to Eye with only the "photo" part enabled, which returns the photo type. This takes about 40 ms per photo.
- **Categories** (same rules as eye-photo-sorter):
  - **receipt**: type or tag `receipt`
  - **document**: `document`, `whiteboard` or `id_card`
  - **screenshot**: listed only when asked
  - **other**: everything else, never offered for import
- **Result cache.** Each result is cached by path, size and modification time in `cache/eye/results.json` (written in batches), so rescanning a folder only analyzes new or changed photos.

## Scans

[apps/server/src/photo-sort/scan.ts](../apps/server/src/photo-sort/scan.ts):

- A scan walks the folder and its subfolders in name order, skipping hidden entries and `node_modules`, and collects photos (JPG, JPEG, JFIF, PNG, GIF, WebP, TIFF). It stops at 5,000 photos and flags the result as truncated.
- Scanning the disk root or the home folder itself is refused; pick a specific folder.
- Photos are analyzed two at a time. Each item records its category, Eye's most likely type and its confidence, and whether a document with the same content already exists in doc-ai (by MD5).
- Scans run in the background and are kept in memory (the last 10). The UI polls `GET /api/local/photo-sort/scan/:id`; the MCP tool waits up to 45 seconds and then hands back a scan ID for `get_folder_scan`.
- Thumbnails are only served for paths that appear in a kept scan, so the thumbnail route can't be used to read arbitrary files.

## Importing

[apps/server/src/photo-sort/import.ts](../apps/server/src/photo-sort/import.ts) follows the same path as a UI upload:

1. Resolves the target doc-ai folder: by ID; else by name (case-insensitive, created under the root if missing); else the root folder.
2. For each path (must be absolute and a supported photo): reads it and hashes it. Content already in doc-ai is reported as skipped.
3. Picks a free path in the watch folder (root folder → watch folder itself; other folders → a subfolder with the folder's name), creates the document row with the hash first (so the watcher recognizes the copied file and leaves it alone), copies the file, and runs `finishIngest`, which queues classification.
4. Returns what was imported (with the saved path and document ID), skipped and failed.

From there the photo is processed like any other document; see [Processing pipeline](processing-pipeline.md).

## Limitations

- Photos only. PDFs are planned, rasterized to images first. HEIC isn't supported yet.
- Requires the native Eye core, so macOS or Linux.

## License note

Eye is under the Desert Ant Labs Source-Available License: free below 100,000 monthly active devices, with a request for credit. It sends usage telemetry to Desert Ant's license server. The dependency is `@desert-ant-labs/eye` in [apps/server/package.json](../apps/server/package.json).
