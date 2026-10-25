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
  getConfig,
  getModelProviderForOrg,
  readSettings,
  writeSettings,
  type LocalSettings,
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
    gatewayApiKeySet: Boolean(config.gatewayApiKey),
    gatewayApiKeyLast4: config.gatewayApiKey ? config.gatewayApiKey.slice(-4) : null,
    gatewayApiKeySource: saved.gatewayApiKey ? "settings" : config.gatewayApiKey ? "env" : null,
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
    if (input.provider !== "gateway" && input.provider !== "ollama") {
      throw new SettingsError(`Unknown provider: ${String(input.provider)}`);
    }
    update.provider = input.provider;
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
