/**
 * Folder scans: walk a folder (subfolders included), classify every photo with
 * Eye and report which ones are receipts or documents. A scan runs in the
 * background; the UI polls it, MCP waits for it.
 *
 * Scans live in memory (the last few are kept). The per-file Eye results are
 * cached on disk, so scanning a folder again is fast.
 */
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { LOCAL_ORG_ID, findDocumentByContentHashForOrg } from "@zdocs/db-schema";
import { expandHome } from "@zdocs/db-schema/data-dir";
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
    const existing = await findDocumentByContentHashForOrg(LOCAL_ORG_ID, md5(buffer));
    const result = await classifyPhoto(file, buffer, stat);
    return { path: file, relPath, size: stat.size, ...result, existingDocumentId: existing?.id ?? null };
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

export async function startScan(folder: string): Promise<Scan> {
  const root = resolveFolder(folder);
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new ScanError(`Not a folder: ${root}`);
  if (root === path.parse(root).root || root === os.homedir()) {
    throw new ScanError("Pick a specific folder, not the whole disk or home folder");
  }

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
    } catch (error) {
      scan.status = "error";
      scan.error = error instanceof Error ? error.message : String(error);
      console.error(`[Eye] Scan of ${root} failed:`, error);
    } finally {
      scan.finishedAt = Date.now();
    }
  })();

  scans.set(scan.id, scan);
  // Forget the oldest scans
  for (const id of [...scans.keys()].slice(0, Math.max(0, scans.size - KEEP_SCANS))) scans.delete(id);
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
  counts: Record<PhotoCategory, number>;
  /** Receipts and documents (plus screenshots when asked), in folder order */
  items: ScanItem[];
}

export function viewScan(scan: Scan, opts: { includeScreenshots?: boolean; includeAll?: boolean } = {}): ScanView {
  const counts: Record<PhotoCategory, number> = { receipt: 0, document: 0, screenshot: 0, other: 0 };
  for (const it of scan.items) counts[it.category]++;
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
    counts,
    items: scan.items.filter((it) => categories.includes(it.category)),
  };
}
