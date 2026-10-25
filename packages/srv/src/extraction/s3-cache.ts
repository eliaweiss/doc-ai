/**
 * doc-ai: filesystem replacement for zdocs' S3 cache (same exported API).
 *
 * - Cache entries live under `${DOC_AI_DATA_DIR}/cache/<cacheKey>`.
 * - Documents are read from the watched folder: `s3Key` is the path relative
 *   to the watch root and `s3Bucket` is "local" (see apps/server/src/watcher.ts).
 *   Derived files (e.g. XLSX converted to CSV) use `s3Bucket` "cache" and live
 *   in the cache dir, so doc-ai never writes into the user's folder.
 */
import { promises as fs } from "fs";
import path from "path";
import { getCacheDir, resolveDocumentPath } from "../local/paths";

function cachePath(cacheKey: string): string {
  const root = getCacheDir();
  const resolved = path.resolve(root, cacheKey);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error(`Invalid cache key: ${cacheKey}`);
  }
  return resolved;
}

/**
 * Get a cached item
 * @returns The cached content as string, or null if not found
 */
export async function getFromCache(
  cacheKey: string,
  _options?: { bucket?: string; region?: string }
): Promise<string | null> {
  try {
    return await fs.readFile(cachePath(cacheKey), "utf8");
  } catch {
    return null;
  }
}

/**
 * Get a cached JSON item
 * @returns The parsed JSON object, or null if not found
 */
export async function getJsonFromCache<T>(
  cacheKey: string,
  options?: { bucket?: string; region?: string }
): Promise<T | null> {
  const content = await getFromCache(cacheKey, options);
  if (!content) return null;

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Save content to cache
 */
export async function saveToCache(
  cacheKey: string,
  content: string,
  _contentType: string = "text/plain",
  _options?: { bucket?: string; region?: string }
): Promise<void> {
  const file = cachePath(cacheKey);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}

/**
 * Save JSON to cache
 */
export async function saveJsonToCache<T>(
  cacheKey: string,
  data: T,
  options?: { bucket?: string; region?: string }
): Promise<void> {
  await saveToCache(cacheKey, JSON.stringify(data), "application/json", options);
}

/**
 * Delete all cached items under a given prefix.
 * @returns Number of files deleted
 */
export async function deleteCacheByPrefix(prefix: string): Promise<number> {
  const target = cachePath(prefix);
  let count = 0;

  // Prefix may be a directory ("extraction/{hash}/{schema}/") or a partial name
  const dir = prefix.endsWith("/") ? target : path.dirname(target);
  const namePrefix = prefix.endsWith("/") ? "" : path.basename(target);

  async function walk(p: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        await fs.unlink(full);
        count++;
      }
    }
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.name.startsWith(namePrefix)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        await fs.unlink(full);
        count++;
      }
    }
  } catch {
    return 0;
  }

  console.log(`[Cache] Deleted ${count} cache entries under prefix: ${prefix}`);
  return count;
}

export const LOCAL_BUCKET = "local";
export const CACHE_BUCKET = "cache";

/**
 * Fetch a document's bytes: from the watched folder ("local") or the cache dir ("cache").
 */
export async function fetchDocumentFromS3(
  bucket: string,
  key: string,
  _region?: string
): Promise<Buffer> {
  if (bucket === CACHE_BUCKET) return fs.readFile(cachePath(key));
  return fs.readFile(resolveDocumentPath(key));
}
