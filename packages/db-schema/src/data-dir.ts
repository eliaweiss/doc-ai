/**
 * doc-ai: where the PGlite DB, caches and settings.json live.
 *
 * Resolved once per process: DOC_AI_DATA_DIR, else the folder chosen on the
 * Settings page, else ~/.doc-ai. The Settings choice is kept in a pointer file
 * at a fixed location (~/.doc-ai/data-dir.json), since settings.json itself
 * lives inside the data dir. A new choice takes effect on the next restart.
 *
 * Imported as "@zdocs/db-schema/data-dir" so it doesn't open the database.
 */
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
