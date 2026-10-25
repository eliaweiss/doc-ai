import path from "path";
import { getConfig } from "./config";

export function getCacheDir(): string {
  return path.join(getConfig().dataDir, "cache");
}

/**
 * Resolve a document key (path relative to the watch folder) to an absolute path.
 * Rejects keys that escape the watch folder.
 */
export function resolveDocumentPath(key: string): string {
  const { watchDir } = getConfig();
  if (!watchDir) throw new Error("DOC_AI_WATCH_DIR is not set");
  const resolved = path.resolve(watchDir, key);
  if (resolved !== watchDir && !resolved.startsWith(watchDir + path.sep)) {
    throw new Error(`Document path escapes watch folder: ${key}`);
  }
  return resolved;
}
