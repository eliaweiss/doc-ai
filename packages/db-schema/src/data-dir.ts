/**
 * doc-ai: where settings.json and the per-watch-folder workspaces (PGlite DB, caches) live.
 *
 * Resolved once per process: DOC_AI_DATA_DIR, else the folder chosen on the
 * Settings page, else ~/.doc-ai. The Settings choice is kept in a pointer file
 * at a fixed location (~/.doc-ai/data-dir.json), since settings.json itself
 * lives inside the data dir. A new choice takes effect on the next restart.
 *
 * Imported as "@zdocs/db-schema/data-dir" so it doesn't open the database.
 */
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export type DataDirSource = "env" | "settings" | "default";

export const DEFAULT_DATA_DIR = "~/.doc-ai";

export function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

function pointerPath(): string {
  return path.join(expandHome(DEFAULT_DATA_DIR), "data-dir.json");
}

/** The data folder chosen on the Settings page, if any */
export function readConfiguredDataDir(): string | null {
  try {
    const { dataDir } = JSON.parse(fs.readFileSync(pointerPath(), "utf8")) as { dataDir?: unknown };
    return typeof dataDir === "string" && dataDir ? path.resolve(expandHome(dataDir)) : null;
  } catch {
    return null;
  }
}

/** Save the data folder for the next start (null goes back to the default). */
export function writeConfiguredDataDir(dir: string | null): void {
  const file = pointerPath();
  if (dir === null) {
    fs.rmSync(file, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ dataDir: dir }, null, 2));
}

let active: { dir: string; source: DataDirSource } | null = null;

function resolveActive() {
  if (active) return active;
  const fromEnv = process.env.DOC_AI_DATA_DIR;
  const configured = fromEnv ? null : readConfiguredDataDir();
  active = fromEnv
    ? { dir: path.resolve(expandHome(fromEnv)), source: "env" }
    : configured
      ? { dir: configured, source: "settings" }
      : { dir: path.resolve(expandHome(DEFAULT_DATA_DIR)), source: "default" };
  return active;
}

/** The data folder this process uses (fixed for its lifetime) */
export function getDataDir(): string {
  return resolveActive().dir;
}

export function getDataDirSource(): DataDirSource {
  return resolveActive().source;
}

/** The data folder the next start will use */
export function getNextDataDir(): string {
  if (process.env.DOC_AI_DATA_DIR) return getDataDir();
  return readConfiguredDataDir() ?? path.resolve(expandHome(DEFAULT_DATA_DIR));
}

/**
 * Each watch folder gets its own workspace inside the data folder: its own
 * PGlite DB, caches and trash, so switching folders never mixes or loses data.
 * settings.json stays at the data folder root (it holds the current watch folder).
 *
 *   <data dir>/workspaces/<folder name>-<hash of its path>/{pgdata,cache,trash}
 *   <data dir>/workspaces/no-watch-folder/   when no watch folder is set
 */
export function getWorkspaceDir(watchDir: string | null): string {
  const root = path.join(getDataDir(), "workspaces");
  if (!watchDir) return path.join(root, "no-watch-folder");
  const resolved = path.resolve(expandHome(watchDir));
  const name = path.basename(resolved).replace(/[^\w.-]+/g, "_").slice(0, 40) || "folder";
  const hash = createHash("sha1").update(resolved).digest("hex").slice(0, 8);
  return path.join(root, `${name}-${hash}`);
}

/** Create the workspace folder; returns whether it is new (no database yet). */
export function ensureWorkspaceDir(watchDir: string | null): { dir: string; isNew: boolean } {
  const dir = getWorkspaceDir(watchDir);
  const isNew = !fs.existsSync(path.join(dir, "pgdata"));
  fs.mkdirSync(dir, { recursive: true });
  // For humans browsing the data folder: which watch folder this belongs to
  fs.writeFileSync(path.join(dir, "workspace.json"), JSON.stringify({ watchDir }, null, 2));
  return { dir, isNew };
}

/**
 * Before workspaces, pgdata/, cache/ and trash/ sat at the data folder root and
 * belonged to whatever watch folder was set. Move them into that folder's
 * workspace. Must run while the database is closed.
 */
export function migrateLegacyDataDir(watchDir: string | null): void {
  const root = getDataDir();
  if (!fs.existsSync(path.join(root, "pgdata"))) return;
  const dir = getWorkspaceDir(watchDir);
  if (fs.existsSync(path.join(dir, "pgdata"))) return;
  ensureWorkspaceDir(watchDir);
  for (const entry of ["pgdata", "cache", "trash"]) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, entry));
  }
  console.log(`[doc-ai] Moved the existing database into ${dir}`);
}
