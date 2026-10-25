/**
 * Folder scans: walk a folder (subfolders included), classify every photo with
 * Eye and report which ones are receipts or documents. A scan runs in the
 * background; the UI polls it, MCP waits for it.
 *
 * Scans live in memory (the last few are kept). Each finished scan is also
 * saved to `<data dir>/scans/` (the latest one per folder), so a later scan of
 * the same folder can offer to reuse it. The per-file Eye results are cached on
 * disk too, so scanning a folder again is fast.
 */
import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { LOCAL_ORG_ID, findDocumentByContentHashForOrg } from "@zdocs/db-schema";
import { expandHome, getDataDir } from "@zdocs/db-schema/data-dir";
import { md5 } from "../watcher";
import { PHOTO_EXTENSIONS, classifyPhoto, type PhotoCategory } from "./eye";

/** Categories offered for import (and selected by default) */
export const DOCUMENT_CATEGORIES: PhotoCategory[] = ["receipt", "document"];

const MAX_FILES = 5000;
const LANES = 2;
const KEEP_SCANS = 10;

export interface ScanItem {
  path: string;
  /** Relative to the scanned folder */
  relPath: string;
  size: number;
  category: PhotoCategory;
  kind: string | null;
  confidence: number;
  /** Same content is already a doc-ai document */
  existingDocumentId: string | null;
  /** MD5 of the file, to re-check existingDocumentId when a saved scan is reused */
  contentHash?: string;
  error?: string;
}

export interface Scan {
  id: string;
  folder: string;
  status: "running" | "done" | "error";
  /** Photos found / analyzed so far */
  total: number;
  done: number;
  /** True when the folder had more than MAX_FILES photos */
  truncated: boolean;
  items: ScanItem[];
  error?: string;
  startedAt: number;
  finishedAt?: number;
  /** Loaded from a saved scan file instead of scanned now */
  reused?: boolean;
  promise: Promise<void>;
}

const scans = new Map<string, Scan>();

export class ScanError extends Error {}

export function resolveFolder(folder: string): string {
  const trimmed = folder.trim();
  if (!trimmed) throw new ScanError("Folder is required");
  return path.resolve(expandHome(trimmed));
}

async function listPhotos(root: string): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  const walk = async (dir: string): Promise<boolean> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return true; // unreadable subfolder: skip it
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!(await walk(full))) return false;
      } else if (entry.isFile() && PHOTO_EXTENSIONS.has(path.extname(entry.name).slice(1).toLowerCase())) {
        files.push(full);
        if (files.length >= MAX_FILES) return false;
      }
    }
    return true;
  };
  const complete = await walk(root);
  return { files, truncated: !complete };
}

async function analyzeFile(root: string, file: string): Promise<ScanItem> {
  const relPath = path.relative(root, file);
  try {
    const stat = await fs.stat(file);
    const buffer = await fs.readFile(file);
    const contentHash = md5(buffer);
    const existing = await findDocumentByContentHashForOrg(LOCAL_ORG_ID, contentHash);
    const result = await classifyPhoto(file, buffer, stat);
    return { path: file, relPath, size: stat.size, ...result, existingDocumentId: existing?.id ?? null, contentHash };
  } catch (error) {
    return {
      path: file,
      relPath,
      size: 0,
      category: "other",
      kind: null,
      confidence: 0,
      existingDocumentId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkFolder(folder: string): Promise<string> {
  const root = resolveFolder(folder);
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new ScanError(`Not a folder: ${root}`);
  if (root === path.parse(root).root || root === os.homedir()) {
    throw new ScanError("Pick a specific folder, not the whole disk or home folder");
  }
  return root;
}

function registerScan(scan: Scan) {
  scans.set(scan.id, scan);
  // Forget the oldest scans
  for (const id of [...scans.keys()].slice(0, Math.max(0, scans.size - KEEP_SCANS))) scans.delete(id);
}

// ---- saved scans: <data dir>/scans/<sha1 of folder>.json ----

interface SavedScanFile {
  version: 1;
  id: string;
  folder: string;
  startedAt: number;
  finishedAt: number;
  total: number;
  truncated: boolean;
  items: ScanItem[];
}

export interface SavedScanInfo {
  folder: string;
  scannedAt: string;
  total: number;
  truncated: boolean;
  counts: Record<PhotoCategory, number>;
}

function savedScanPath(root: string) {
  return path.join(getDataDir(), "scans", `${createHash("sha1").update(root).digest("hex")}.json`);
}

async function saveScan(scan: Scan) {
  const file: SavedScanFile = {
    version: 1,
    id: scan.id,
    folder: scan.folder,
    startedAt: scan.startedAt,
    finishedAt: scan.finishedAt ?? Date.now(),
    total: scan.total,
    truncated: scan.truncated,
    items: scan.items,
  };
  const target = savedScanPath(scan.folder);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(file));
}

async function readSavedScan(root: string): Promise<SavedScanFile | null> {
  try {
    const file = JSON.parse(await fs.readFile(savedScanPath(root), "utf8")) as SavedScanFile;
    return file.version === 1 && file.folder === root ? file : null;
  } catch {
    return null;
  }
}

function countCategories(items: ScanItem[]) {
  const counts: Record<PhotoCategory, number> = { receipt: 0, document: 0, screenshot: 0, other: 0 };
  for (const it of items) counts[it.category]++;
  return counts;
}

/** The saved scan of a folder, if there is one (without loading it) */
export async function getSavedScanInfo(folder: string): Promise<SavedScanInfo | null> {
  const root = await checkFolder(folder);
  const saved = await readSavedScan(root);
  if (!saved) return null;
  return {
    folder: root,
    scannedAt: new Date(saved.finishedAt).toISOString(),
    total: saved.total,
    truncated: saved.truncated,
    counts: countCategories(saved.items),
  };
}

/**
 * Load a folder's saved scan as a finished scan. Photos deleted since are
 * dropped and "already in doc-ai" is checked again (files may have been imported since).
 */
export async function reuseSavedScan(folder: string): Promise<Scan> {
  const root = await checkFolder(folder);
  const saved = await readSavedScan(root);
  if (!saved) throw new ScanError(`No saved scan for ${root}`);
  const items: ScanItem[] = [];
  for (const it of saved.items) {
    if (!(await fs.stat(it.path).catch(() => null))) continue;
    const existing = it.contentHash ? await findDocumentByContentHashForOrg(LOCAL_ORG_ID, it.contentHash) : null;
    items.push({ ...it, existingDocumentId: existing?.id ?? (it.contentHash ? null : it.existingDocumentId) });
  }
  const scan: Scan = {
    id: randomUUID(),
    folder: root,
    status: "done",
    total: items.length,
    done: items.length,
    truncated: saved.truncated,
    items,
    startedAt: saved.startedAt,
    finishedAt: saved.finishedAt,
    reused: true,
    promise: Promise.resolve(),
  };
  registerScan(scan);
  return scan;
}

export async function startScan(folder: string): Promise<Scan> {
  const root = await checkFolder(folder);

  const scan: Scan = {
    id: randomUUID(),
    folder: root,
    status: "running",
    total: 0,
    done: 0,
    truncated: false,
    items: [],
    startedAt: Date.now(),
    promise: Promise.resolve(),
  };

  scan.promise = (async () => {
    try {
      const { files, truncated } = await listPhotos(root);
      scan.total = files.length;
      scan.truncated = truncated;
      const items: ScanItem[] = new Array(files.length);
      let next = 0;
      await Promise.all(
        Array.from({ length: LANES }, async () => {
          while (next < files.length) {
            const i = next++;
            items[i] = await analyzeFile(root, files[i]);
            scan.done++;
          }
        })
      );
      scan.items = items;
      scan.status = "done";
      const found = items.filter((it) => DOCUMENT_CATEGORIES.includes(it.category)).length;
      console.log(`[Eye] Scanned ${root}: ${files.length} photos, ${found} receipts/documents`);
      scan.finishedAt = Date.now();
      await saveScan(scan).catch((error) => console.error(`[Eye] Failed to save scan of ${root}:`, error));
    } catch (error) {
      scan.status = "error";
      scan.error = error instanceof Error ? error.message : String(error);
      console.error(`[Eye] Scan of ${root} failed:`, error);
    } finally {
      scan.finishedAt ??= Date.now();
    }
  })();

  registerScan(scan);
  return scan;
}

export function getScan(id: string): Scan | null {
  return scans.get(id) ?? null;
}

/** Whether a path was returned by one of the kept scans (thumbnails are only served for those) */
export function isScannedPath(file: string): boolean {
  for (const scan of scans.values()) {
    if (scan.items.some((it) => it?.path === file)) return true;
  }
  return false;
}

export interface ScanView {
  scanId: string;
  folder: string;
  status: Scan["status"];
  total: number;
  done: number;
  truncated: boolean;
  error?: string;
  elapsedMs: number;
  /** When the photos were analyzed (ISO), set once the scan is done */
  scannedAt: string | null;
  /** Loaded from the saved scan instead of scanned now */
  reused: boolean;
  counts: Record<PhotoCategory, number>;
  /** Receipts and documents (plus screenshots when asked), in folder order */
  items: ScanItem[];
}

export function viewScan(scan: Scan, opts: { includeScreenshots?: boolean; includeAll?: boolean } = {}): ScanView {
  const counts = countCategories(scan.items);
  const categories: PhotoCategory[] = opts.includeAll
    ? ["receipt", "document", "screenshot", "other"]
    : opts.includeScreenshots
      ? [...DOCUMENT_CATEGORIES, "screenshot"]
      : DOCUMENT_CATEGORIES;
  return {
    scanId: scan.id,
    folder: scan.folder,
    status: scan.status,
    total: scan.total,
    done: scan.done,
    truncated: scan.truncated,
    error: scan.error,
    elapsedMs: (scan.finishedAt ?? Date.now()) - scan.startedAt,
    scannedAt: scan.status === "done" && scan.finishedAt ? new Date(scan.finishedAt).toISOString() : null,
    reused: scan.reused ?? false,
    counts,
    items: scan.items.filter((it) => categories.includes(it.category)),
  };
}
