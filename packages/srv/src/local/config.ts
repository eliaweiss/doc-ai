/**
 * doc-ai local configuration.
 *
 * Values come from environment variables (.env), overridden by settings saved
 * from the UI in `<data dir>/settings.json`. The data dir is resolved by
 * @zdocs/db-schema/data-dir (env, else the Settings page, else ~/.doc-ai); the
 * port can only be set through the environment.
 *
 * DOC_AI_WATCH_DIR   folder to watch for documents (required to run the watcher)
 * DOC_AI_DATA_DIR    where settings.json and the per-watch-folder workspaces (PGlite DB,
 *                    caches) live (overrides the Settings page)
 * DOC_AI_PROVIDER    ollama | local | gateway (default) | openrouter | openai | anthropic | google
 * AI_GATEWAY_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY,
 * GOOGLE_GENERATIVE_AI_API_KEY   keys for those providers
 * OLLAMA_BASE_URL    default http://localhost:11434
 * DOC_AI_OLLAMA_MODEL default qwen3.5:9b (must be a vision model)
 * PORT               HTTP port for UI + API + MCP (default 4310)
 */
import fs from "fs";
import path from "path";
import { getOpenWorkspaceDir } from "@zdocs/db-schema";
import { expandHome, getDataDir, getWorkspaceDir } from "@zdocs/db-schema/data-dir";
import {
  CLOUD_PROVIDERS,
  DEFAULT_CLOUD_MODELS,
  DEFAULT_OLLAMA_MODEL,
  KEY_ENV_VARS,
  KEY_PROVIDERS,
  isProviderKind,
  type CloudProvider,
  type KeyProvider,
  type ProviderKind,
  type StepModels,
} from "../ai/providers";

export type { ProviderKind };

export interface DocAiConfig {
  watchDir: string | null;
  dataDir: string;
  /** This watch folder's DB, caches and trash (see data-dir.ts) */
  workspaceDir: string;
  provider: ProviderKind;
  /** The setup wizard hasn't been completed and no provider is configured */
  setupNeeded: boolean;
  apiKeys: Record<KeyProvider, string | null>;
  /** Kept for callers that only know the gateway */
  gatewayApiKey: string | null;
  cloudModels: Record<CloudProvider, StepModels>;
  ollamaBaseUrl: string;
  ollamaModel: string;
  port: number;
}

/** Settings that can be changed from the UI (persisted in settings.json) */
export interface LocalSettings {
  watchDir?: string | null;
  provider?: ProviderKind;
  setupDone?: boolean;
  gatewayApiKey?: string | null;
  openrouterApiKey?: string | null;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
  googleApiKey?: string | null;
  cloudModels?: Partial<Record<CloudProvider, StepModels>>;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

/** settings.json field that holds each provider's key */
export const keySettingName = (provider: KeyProvider) => `${provider}ApiKey` as const;

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

/** Merge into settings.json (owner-only permissions: it may hold API keys). */
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
  const resolvedWatchDir = watchDir ? path.resolve(expandHome(watchDir)) : null;
  const apiKeys = Object.fromEntries(
    KEY_PROVIDERS.map((p) => [p, saved[keySettingName(p)] || env[KEY_ENV_VARS[p]] || null])
  ) as Record<KeyProvider, string | null>;
  const cloudModels = Object.fromEntries(
    CLOUD_PROVIDERS.map((p) => [p, { ...DEFAULT_CLOUD_MODELS[p], ...saved.cloudModels?.[p] }])
  ) as Record<CloudProvider, StepModels>;
  return {
    watchDir: resolvedWatchDir,
    dataDir: getDataDir(),
    // The open database's workspace, so caches follow the DB during a switch
    workspaceDir: getOpenWorkspaceDir() ?? getWorkspaceDir(resolvedWatchDir),
    provider: isProviderKind(provider) ? provider : "gateway",
    // Installs from before the wizard already chose a provider (or set a gateway key)
    setupNeeded: !saved.setupDone && !provider && !apiKeys.gateway,
    apiKeys,
    gatewayApiKey: apiKeys.gateway,
    cloudModels,
    ollamaBaseUrl: saved.ollamaBaseUrl || env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel: saved.ollamaModel || env.DOC_AI_OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
    port: Number(env.PORT || 4310),
  };
}
