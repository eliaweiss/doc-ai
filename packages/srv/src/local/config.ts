/**
 * doc-ai local configuration.
 *
 * Values come from environment variables (.env), overridden by settings saved
 * from the UI in `<data dir>/settings.json`. The data dir is resolved by
 * @zdocs/db-schema/data-dir (env, else the Settings page, else ~/.doc-ai); the
 * port can only be set through the environment.
 *
 * DOC_AI_WATCH_DIR   folder to watch for documents (required to run the watcher)
 * DOC_AI_DATA_DIR    where the PGlite DB, caches and settings.json live (overrides the Settings page)
 * DOC_AI_PROVIDER    "gateway" (Vercel AI Gateway, default) | "ollama"
 * AI_GATEWAY_API_KEY Vercel AI Gateway key (gateway provider)
 * OLLAMA_BASE_URL    default http://localhost:11434
 * DOC_AI_OLLAMA_MODEL default qwen3.5:9b (must be a vision model)
 * PORT               HTTP port for UI + API + MCP (default 4310)
 */
import fs from "fs";
import path from "path";
import { expandHome, getDataDir } from "@zdocs/db-schema/data-dir";

export type ProviderKind = "gateway" | "ollama";

export interface DocAiConfig {
  watchDir: string | null;
  dataDir: string;
  provider: ProviderKind;
  gatewayApiKey: string | null;
  ollamaBaseUrl: string;
  ollamaModel: string;
  port: number;
}

/** Settings that can be changed from the UI (persisted in settings.json) */
export interface LocalSettings {
  watchDir?: string | null;
  provider?: ProviderKind;
  gatewayApiKey?: string | null;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export function getSettingsPath(): string {
  return path.join(getDataDir(), "settings.json");
}

let cachedSettings: LocalSettings | null = null;

export function readSettings(): LocalSettings {
  if (cachedSettings) return cachedSettings;
  try {
    cachedSettings = JSON.parse(fs.readFileSync(getSettingsPath(), "utf8")) as LocalSettings;
  } catch {
    cachedSettings = {};
  }
  return cachedSettings;
}

/** Merge into settings.json (owner-only permissions: it may hold the API key). */
export function writeSettings(update: LocalSettings): LocalSettings {
  const next = { ...readSettings(), ...update };
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  cachedSettings = next;
  return next;
}

export function getConfig(): DocAiConfig {
  const env = process.env;
  const saved = readSettings();
  const watchDir = saved.watchDir !== undefined ? saved.watchDir : env.DOC_AI_WATCH_DIR;
  const provider = saved.provider ?? env.DOC_AI_PROVIDER;
  return {
    watchDir: watchDir ? path.resolve(expandHome(watchDir)) : null,
    dataDir: getDataDir(),
    provider: provider === "ollama" ? "ollama" : "gateway",
    gatewayApiKey: saved.gatewayApiKey || env.AI_GATEWAY_API_KEY || null,
    ollamaBaseUrl: saved.ollamaBaseUrl || env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel: saved.ollamaModel || env.DOC_AI_OLLAMA_MODEL || "qwen3.5:9b",
    port: Number(env.PORT || 4310),
  };
}
