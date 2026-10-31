/**
 * Local processing settings for the Settings page (GET/POST /api/local/settings).
 * The API key is never returned, only whether one is set and its last 4 characters.
 */
import { execFile } from "child_process";
import { constants as fsConstants, promises as fs } from "fs";
import path from "path";
import { generateText } from "ai";
import { AI_MODEL_MAP, AI_USAGE_ACTIONS, DEFAULT_AI_PROVIDER, type AiUsageAction } from "@zdocs/types";
import {
  DEFAULT_CLOUD_MODELS,
  KEY_ENV_VARS,
  KEY_PROVIDERS,
  getConfig,
  getLocalModelStatus,
  getModelProviderForOrg,
  isCloudProvider,
  isKeyProvider,
  isProviderKind,
  keySettingName,
  readSettings,
  stopLocalModel,
  writeSettings,
  type LocalSettings,
  type StepModels,
} from "@zdocs/srv";
import {
  LOCAL_ORG_ID,
  getAiModelSelectionsForOrg,
  setAiModelSelectionsForOrg,
  type AiModelSelections,
} from "@zdocs/db-schema";
import {
  DEFAULT_DATA_DIR,
  expandHome,
  getDataDirSource,
  getNextDataDir,
  writeConfiguredDataDir,
} from "@zdocs/db-schema/data-dir";

/** Actions doc-ai runs, in the order the Settings page lists them */
const MODEL_ACTIONS: AiUsageAction[] = ["CLASSIFY_DOCUMENT", "EXTRACT_DOCUMENT"];

const toGatewayId = (m: { modelProvider: string; modelSlug: string }) =>
  `${m.modelProvider}/${m.modelSlug}`;

/** Every gateway model id that appears in AI_MODEL_MAP */
const MODEL_OPTIONS = [
  ...new Set(
    Object.values(AI_MODEL_MAP).flatMap((profile) => Object.values(profile).map(toGatewayId))
  ),
].sort();

export async function getPublicSettings() {
  const config = getConfig();
  const saved = readSettings();
  const selections = await getAiModelSelectionsForOrg(LOCAL_ORG_ID);
  return {
    watchDir: config.watchDir,
    dataDir: config.dataDir,
    // Differs from dataDir after a change, until the server restarts
    dataDirNext: getNextDataDir(),
    dataDirSource: getDataDirSource(),
    provider: config.provider,
    setupNeeded: config.setupNeeded,
    // Per key provider: whether a key is set, its last 4 characters and where it comes from
    apiKeys: Object.fromEntries(
      KEY_PROVIDERS.map((p) => {
        const key = config.apiKeys[p];
        const source = saved[keySettingName(p)] ? "settings" : key ? "env" : null;
        return [p, { set: Boolean(key), last4: key ? key.slice(-4) : null, source, envVar: KEY_ENV_VARS[p] }];
      })
    ),
    cloudModels: config.cloudModels,
    defaultCloudModels: DEFAULT_CLOUD_MODELS,
    localModel: getLocalModelStatus(),
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaModel: config.ollamaModel,
    models: MODEL_ACTIONS.map((action) => {
      const fallback = toGatewayId(AI_MODEL_MAP[DEFAULT_AI_PROVIDER][action]);
      const selected = selections[action];
      return { action, model: selected ? toGatewayId(selected) : fallback, defaultModel: fallback };
    }),
    modelOptions: MODEL_OPTIONS,
  };
}

export class SettingsError extends Error {}

const isInside = (dir: string, parent: string) => dir === parent || dir.startsWith(parent + path.sep);

/** Validate and save. Returns whether the watch folder changed (a new data folder waits for a restart). */
export async function saveSettings(input: Record<string, unknown>): Promise<{ watchDirChanged: boolean }> {
  const before = getConfig();
  const update: LocalSettings = {};

  // Empty string goes back to the default (~/.doc-ai). Takes effect on restart.
  let nextDataDir = getNextDataDir();
  let dataDirChanged = false;
  if (typeof input.dataDir === "string") {
    const dir = path.resolve(expandHome(input.dataDir.trim() || DEFAULT_DATA_DIR));
    if (dir !== nextDataDir) {
      if (getDataDirSource() === "env") {
        throw new SettingsError("The data folder is set by DOC_AI_DATA_DIR in .env; change it there");
      }
      await fs.mkdir(dir, { recursive: true }).catch((error) => {
        throw new SettingsError(`Can't create ${dir}: ${error.message}`);
      });
      nextDataDir = dir;
      dataDirChanged = true;
    }
  }

  if (typeof input.watchDir === "string") {
    const dir = path.resolve(expandHome(input.watchDir.trim()));
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat?.isDirectory()) throw new SettingsError(`Folder not found: ${dir}`);
    update.watchDir = dir;
  }
  const watchDir = update.watchDir ?? before.watchDir;
  if (watchDir && (update.watchDir || dataDirChanged)) {
    for (const dataDir of new Set([before.dataDir, nextDataDir])) {
      if (isInside(watchDir, dataDir) || isInside(dataDir, watchDir)) {
        throw new SettingsError("The watch folder and the data folder can't be inside each other");
      }
    }
  }
  if (input.provider !== undefined) {
    if (!isProviderKind(input.provider)) throw new SettingsError(`Unknown provider: ${String(input.provider)}`);
    update.provider = input.provider;
  }
  if (input.setupDone === true) update.setupDone = true;
  // { [provider]: { classify, extract } } for the cloud providers
  if (input.cloudModels !== undefined) {
    if (typeof input.cloudModels !== "object" || input.cloudModels === null) {
      throw new SettingsError("cloudModels must be an object of provider → { classify, extract }");
    }
    const cloudModels = { ...readSettings().cloudModels };
    for (const [provider, value] of Object.entries(input.cloudModels)) {
      if (!isCloudProvider(provider)) throw new SettingsError(`Unknown cloud provider: ${provider}`);
      const { classify, extract } = (value ?? {}) as Partial<StepModels>;
      if (typeof classify !== "string" || !classify.trim() || typeof extract !== "string" || !extract.trim()) {
        throw new SettingsError(`Choose a classification and an extraction model for ${provider}`);
      }
      cloudModels[provider] = { classify: classify.trim(), extract: extract.trim() };
    }
    update.cloudModels = cloudModels;
  }
  // { [provider]: key }. Empty string keeps the current key; null clears the saved one (falls back to .env)
  if (input.apiKeys !== undefined) {
    if (typeof input.apiKeys !== "object" || input.apiKeys === null) {
      throw new SettingsError("apiKeys must be an object of provider → key");
    }
    for (const [provider, key] of Object.entries(input.apiKeys)) {
      if (!isKeyProvider(provider)) throw new SettingsError(`Unknown provider: ${provider}`);
      if (key === null) update[keySettingName(provider)] = null;
      else if (typeof key === "string" && key.trim()) update[keySettingName(provider)] = key.trim();
    }
  }
  // { [action]: "provider/slug" }, saved to the ai_model_settings table
  const models: AiModelSelections = {};
  if (input.models !== undefined) {
    if (typeof input.models !== "object" || input.models === null) {
      throw new SettingsError("models must be an object of action → model");
    }
    for (const [action, value] of Object.entries(input.models)) {
      if (!(AI_USAGE_ACTIONS as readonly string[]).includes(action)) {
        throw new SettingsError(`Unknown action: ${action}`);
      }
      const match = typeof value === "string" ? value.trim().match(/^([^/\s]+)\/(\S+)$/) : null;
      if (!match) throw new SettingsError(`Invalid model for ${action}: ${String(value)} (expected provider/model)`);
      models[action as AiUsageAction] = { modelProvider: match[1], modelSlug: match[2] };
    }
  }
  // Empty string keeps the current key; null clears the saved one (falls back to .env)
  if (input.gatewayApiKey === null) update.gatewayApiKey = null;
  else if (typeof input.gatewayApiKey === "string" && input.gatewayApiKey.trim()) {
    update.gatewayApiKey = input.gatewayApiKey.trim();
  }
  if (typeof input.ollamaBaseUrl === "string" && input.ollamaBaseUrl.trim()) {
    try {
      new URL(input.ollamaBaseUrl.trim());
    } catch {
      throw new SettingsError(`Invalid Ollama URL: ${input.ollamaBaseUrl}`);
    }
    update.ollamaBaseUrl = input.ollamaBaseUrl.trim();
  }
  if (typeof input.ollamaModel === "string" && input.ollamaModel.trim()) {
    update.ollamaModel = input.ollamaModel.trim();
  }

  await setAiModelSelectionsForOrg(LOCAL_ORG_ID, models);
  writeSettings(update);
  // Free the memory the built-in model holds once another provider is chosen
  if (before.provider === "local" && getConfig().provider !== "local") stopLocalModel();
  if (dataDirChanged) {
    // Carry the provider, key and watch folder over unless that folder already has its own
    await fs
      .copyFile(
        path.join(before.dataDir, "settings.json"),
        path.join(nextDataDir, "settings.json"),
        fsConstants.COPYFILE_EXCL
      )
      .catch(() => {});
    writeConfiguredDataDir(nextDataDir === path.resolve(expandHome(DEFAULT_DATA_DIR)) ? null : nextDataDir);
  }
  return { watchDirChanged: getConfig().watchDir !== before.watchDir };
}

/** Folder picker command for this OS: prints the chosen path, fails on cancel */
function pickerCommand(prompt: string, start: string | null): [string, string[]] | null {
  if (process.platform === "darwin") {
    const at = start ? ` default location (POSIX file ${JSON.stringify(start)})` : "";
    // `activate` brings the dialog in front of the browser
    return ["osascript", ["-e", "activate", "-e", `POSIX path of (choose folder with prompt ${JSON.stringify(prompt)}${at})`]];
  }
  if (process.platform === "linux") {
    return ["zenity", ["--file-selection", "--directory", `--title=${prompt}`, ...(start ? [`--filename=${start}/`] : [])]];
  }
  return null;
}

/**
 * Open the OS folder dialog on this machine (the server only listens on
 * 127.0.0.1, so it's the user's own desktop) and return the chosen folder.
 */
export async function pickFolder(): Promise<{ path: string | null; supported: boolean }> {
  const command = pickerCommand("Choose the folder doc-ai should watch", getConfig().watchDir);
  if (!command) return { path: null, supported: false };
  return new Promise((resolve) => {
    execFile(command[0], command[1], { timeout: 10 * 60_000 }, (error, stdout) => {
      if (error) {
        // ENOENT: no zenity installed; anything else is a cancel
        resolve({ path: null, supported: (error as NodeJS.ErrnoException).code !== "ENOENT" });
        return;
      }
      const chosen = stdout.trim().replace(/(.)\/$/, "$1");
      resolve({ path: chosen || null, supported: true });
    });
  });
}

/** One tiny model call with the current settings (classification model). */
export async function testConnection() {
  const started = Date.now();
  try {
    const model = await getModelProviderForOrg(LOCAL_ORG_ID, "CLASSIFY_DOCUMENT");
    const result = await generateText({
      model: model.modelObj,
      prompt: "Reply with the single word: ok",
      maxOutputTokens: 16,
    });
    return {
      ok: true,
      model: model.modelGatewayId,
      reply: result.text.trim().slice(0, 50),
      ms: Date.now() - started,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
