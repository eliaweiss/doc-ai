/**
 * Backend of the AI setup wizard (routes under /api/local/settings/ai/*):
 * Ollama check and model pull, the built-in local model download, the model
 * list of a cloud provider, and a test call with settings that aren't saved yet.
 * Keys typed in the wizard are only used for the call; saveSettings stores them.
 */
import { createGateway, generateText } from "ai";
import {
  getConfig,
  getModelProviderForConfig,
  isCloudProvider,
  isKeyProvider,
  isProviderKind,
  type CloudProvider,
  type DocAiConfig,
  type KeyProvider,
  type StepModels,
} from "@zdocs/srv";
import { LOCAL_ORG_ID } from "@zdocs/db-schema";

export class AiSetupError extends Error {}

const trimUrl = (url: string) => url.trim().replace(/\/$/, "");

/** The key typed in the wizard, else the saved one */
function keyFor(provider: KeyProvider, typed: unknown): string {
  const key = (typeof typed === "string" && typed.trim()) || getConfig().apiKeys[provider];
  if (!key) throw new AiSetupError("Enter an API key first");
  return key;
}

// ---- Ollama ----

export async function checkOllama(baseUrl: string, model: string) {
  const url = trimUrl(baseUrl);
  try {
    const version = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    const tags = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
    const models: string[] = (tags.models ?? []).map((m: { name: string }) => m.name);
    const wanted = model.includes(":") ? model : `${model}:latest`;
    return { reachable: true, version: version.version as string, models, hasModel: models.includes(wanted) };
  } catch {
    return { reachable: false, version: null, models: [] as string[], hasModel: false };
  }
}

const ollamaPull = {
  state: "idle" as "idle" | "pulling" | "done" | "error",
  model: null as string | null,
  status: null as string | null,
  bytesDone: 0,
  bytesTotal: 0,
  error: null as string | null,
};

export const getOllamaPullStatus = () => ({ ...ollamaPull });

/** Start `ollama pull` through its API; progress is in getOllamaPullStatus(). */
export function startOllamaPull(baseUrl: string, model: string): void {
  if (ollamaPull.state === "pulling") return;
  Object.assign(ollamaPull, { state: "pulling", model, status: "starting", bytesDone: 0, bytesTotal: 0, error: null });
  (async () => {
    const response = await fetch(`${trimUrl(baseUrl)}/api/pull`, {
      method: "POST",
      body: JSON.stringify({ model, stream: true }),
    });
    if (!response.ok || !response.body) throw new Error(`Ollama answered HTTP ${response.status}`);
    // One NDJSON line per update; sizes are per layer (digest)
    const layers = new Map<string, { total: number; completed: number }>();
    const decoder = new TextDecoder();
    let buffered = "";
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        const update = JSON.parse(line);
        if (update.error) throw new Error(update.error);
        ollamaPull.status = update.status;
        if (update.digest && update.total) {
          layers.set(update.digest, { total: update.total, completed: update.completed ?? 0 });
          ollamaPull.bytesTotal = [...layers.values()].reduce((a, l) => a + l.total, 0);
          ollamaPull.bytesDone = [...layers.values()].reduce((a, l) => a + l.completed, 0);
        }
      }
    }
    Object.assign(ollamaPull, { state: "done", status: "success" });
  })().catch((error) => {
    Object.assign(ollamaPull, { state: "error", error: error instanceof Error ? error.message : String(error) });
  });
}

// ---- Cloud model lists ----

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (response.status === 401 || response.status === 403) throw new AiSetupError("The API key was rejected");
  if (!response.ok) throw new AiSetupError(`The provider answered HTTP ${response.status}`);
  return response.json();
}

/** Model ids the provider offers for this key, for the wizard's model pickers (also validates the key). */
export async function listProviderModels(provider: unknown, typedKey: unknown): Promise<string[]> {
  if (!isKeyProvider(provider)) throw new AiSetupError(`Unknown provider: ${String(provider)}`);
  const key = keyFor(provider, typedKey);
  let ids: string[];
  switch (provider) {
    case "openai": {
      const body = await getJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` });
      ids = body.data
        .map((m: { id: string }) => m.id)
        .filter((id: string) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|search)/.test(id));
      break;
    }
    case "anthropic": {
      const body = await getJson("https://api.anthropic.com/v1/models?limit=1000", {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      });
      ids = body.data.map((m: { id: string }) => m.id);
      break;
    }
    case "google": {
      const body = await getJson("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
        "x-goog-api-key": key,
      });
      ids = body.models
        .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: { name: string }) => m.name.replace(/^models\//, ""))
        .filter((id: string) => id.startsWith("gemini-") && !/(tts|image|embedding|live|audio)/.test(id));
      break;
    }
    case "openrouter": {
      // Check the key, then list the models that read images
      await getJson("https://openrouter.ai/api/v1/key", { Authorization: `Bearer ${key}` });
      const body = await getJson("https://openrouter.ai/api/v1/models", {});
      ids = body.data
        .filter((m: { id: string; architecture?: { input_modalities?: string[] } }) =>
          m.architecture?.input_modalities?.includes("image") && !m.id.endsWith(":batch")
        )
        .map((m: { id: string }) => m.id);
      break;
    }
    case "gateway": {
      const { models } = await createGateway({ apiKey: key }).getAvailableModels();
      ids = models.filter((m) => !m.modelType || m.modelType === "language").map((m) => m.id);
      break;
    }
  }
  return [...new Set(ids)].sort();
}

// ---- Test before saving ----

/** The current config with the wizard's unsaved choices applied */
function candidateConfig(input: Record<string, unknown>): DocAiConfig {
  const config = getConfig();
  if (!isProviderKind(input.provider)) throw new AiSetupError(`Unknown provider: ${String(input.provider)}`);
  const provider = input.provider;
  const apiKeys = { ...config.apiKeys };
  if (isKeyProvider(provider) && typeof input.apiKey === "string" && input.apiKey.trim()) {
    apiKeys[provider] = input.apiKey.trim();
  }
  const cloudModels = { ...config.cloudModels };
  if (isCloudProvider(provider) && input.models && typeof input.models === "object") {
    cloudModels[provider as CloudProvider] = { ...cloudModels[provider as CloudProvider], ...(input.models as StepModels) };
  }
  return {
    ...config,
    provider,
    apiKeys,
    gatewayApiKey: apiKeys.gateway,
    cloudModels,
    ollamaBaseUrl: typeof input.ollamaBaseUrl === "string" && input.ollamaBaseUrl.trim() ? input.ollamaBaseUrl.trim() : config.ollamaBaseUrl,
    ollamaModel: typeof input.ollamaModel === "string" && input.ollamaModel.trim() ? input.ollamaModel.trim() : config.ollamaModel,
  };
}

/** One tiny call to each step's model with the wizard's settings. */
export async function testAiSetup(input: Record<string, unknown>) {
  const started = Date.now();
  try {
    const config = candidateConfig(input);
    const results: { model: string; reply: string }[] = [];
    for (const action of ["CLASSIFY_DOCUMENT", "EXTRACT_DOCUMENT"] as const) {
      const model = await getModelProviderForConfig(config, LOCAL_ORG_ID, action);
      // Skip the second call when both steps use the same model
      if (results.some((r) => r.model === model.modelGatewayId)) continue;
      const result = await generateText({
        model: model.modelObj,
        providerOptions: model.providerOptions,
        prompt: "Reply with the single word: ok",
        maxOutputTokens: 64,
      });
      results.push({ model: model.modelGatewayId, reply: result.text.trim().slice(0, 50) });
    }
    return { ok: true, models: results.map((r) => r.model), ms: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
