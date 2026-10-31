/**
 * doc-ai: config-driven replacement for zdocs' billing-aware getModelProviderForOrg.
 * Same signature and result shape; orgId is ignored (single local org).
 *
 * Each setup (see ./providers.ts) goes through its AI SDK provider:
 * - gateway:    Vercel AI Gateway, model per action from Settings (ai_model_settings
 *               table), falling back to AI_MODEL_MAP[DEFAULT_AI_PROVIDER][action]
 * - ollama:     ollama-ai-provider-v2, one model for every action
 * - local:      @ai-sdk/openai-compatible on the llama-server doc-ai runs (local/local-model.ts)
 * - openrouter: @openrouter/ai-sdk-provider
 * - openai, anthropic, google: @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google
 * Cloud setups use one model for classification and one for extraction.
 * Local models get PDFs as page images (./pdf-to-images.ts).
 */
import { createGateway, wrapLanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";
import type { streamText } from "ai";
import { DEFAULT_AI_PROVIDER, type AiUsageAction, type ModelResult } from "@zdocs/types";
import { getAiModelSelectionsForOrg } from "@zdocs/db-schema";
import { getModelConfigForAction, buildGatewayModelId, type ModelConfig } from "./ai-model-config";
import { AiKeyError } from "./detect-api-key-error";
import { pdfToImagesMiddleware } from "./pdf-to-images";
import { getConfig, type DocAiConfig } from "../local/config";
import { LOCAL_MODEL_ID, ensureLocalModelRunning } from "../local/local-model";
import type { CloudProvider } from "./providers";

type ProviderOptions = Parameters<typeof streamText>[0]["providerOptions"];

export interface ModelProviderResult extends ModelResult {
  modelObj: any;
  providerOptions?: ProviderOptions;
}

/** Context for local models: a rendered page image alone takes a few thousand tokens */
const LOCAL_CONTEXT_TOKENS = 16384;

/** Cheap steps use the classification model, the rest the extraction model */
const usesClassifyModel = (action: AiUsageAction) =>
  action === "CLASSIFY_DOCUMENT" || action === "EXTRACT_DOCUMENT_LITE" || action === "CATEGORY_MAPPING";

/**
 * The model for an action: the one selected in Settings, else the default.
 * The default's providerOptions (e.g. thinking budget) are kept only when the
 * selected model is from the same provider.
 */
export async function getModelConfigForOrg(
  orgId: string,
  action: AiUsageAction
): Promise<ModelConfig> {
  const fallback = getModelConfigForAction(DEFAULT_AI_PROVIDER, action);
  const selected = (await getAiModelSelectionsForOrg(orgId))[action];
  if (!selected) return fallback;
  return {
    modelProvider: selected.modelProvider,
    modelSlug: selected.modelSlug,
    providerOptions:
      selected.modelProvider === fallback?.modelProvider ? fallback.providerOptions : undefined,
  };
}

const local = (modelObj: any) => wrapLanguageModel({ model: modelObj, middleware: pdfToImagesMiddleware });

function cloudModel(provider: CloudProvider, apiKey: string, modelSlug: string) {
  switch (provider) {
    case "openrouter":
      return createOpenRouter({ apiKey }).chat(modelSlug);
    case "openai":
      return createOpenAI({ apiKey })(modelSlug);
    case "anthropic":
      return createAnthropic({ apiKey })(modelSlug);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelSlug);
  }
}

export async function getModelProviderForOrg(
  orgId: string,
  action: AiUsageAction
): Promise<ModelProviderResult> {
  return getModelProviderForConfig(getConfig(), orgId, action);
}

/** The model for an action under the given config (the setup wizard tests a config before saving it). */
export async function getModelProviderForConfig(
  config: DocAiConfig,
  orgId: string,
  action: AiUsageAction
): Promise<ModelProviderResult> {
  const provider = config.provider;

  if (provider === "ollama") {
    const ollama = createOllama({ baseURL: `${config.ollamaBaseUrl.replace(/\/$/, "")}/api` });
    return {
      action,
      aiKeyLast4Digits: "",
      modelProvider: "ollama",
      aiProvider: "ollama",
      modelGatewayId: `ollama/${config.ollamaModel}`,
      modelSlug: config.ollamaModel,
      isGateway: false,
      modelObj: local(ollama(config.ollamaModel)),
      // Answer directly: thinking makes extraction several times slower
      providerOptions: { ollama: { think: false, options: { num_ctx: LOCAL_CONTEXT_TOKENS } } },
    };
  }

  if (provider === "local") {
    const baseURL = await ensureLocalModelRunning();
    const llama = createOpenAICompatible({ name: "llama-server", baseURL, supportsStructuredOutputs: true });
    return {
      action,
      aiKeyLast4Digits: "",
      modelProvider: "local",
      aiProvider: "local",
      modelGatewayId: `local/${LOCAL_MODEL_ID}`,
      modelSlug: LOCAL_MODEL_ID,
      isGateway: false,
      modelObj: local(llama.chatModel(LOCAL_MODEL_ID)),
    };
  }

  const apiKey = config.apiKeys[provider];
  if (!apiKey) {
    throw new AiKeyError(
      `No API key is set for ${provider}. Open Settings → Processing and run the AI setup.`,
      "NO_KEY"
    );
  }

  if (provider !== "gateway") {
    const modelSlug = config.cloudModels[provider][usesClassifyModel(action) ? "classify" : "extract"];
    // OpenRouter ids are "vendor/model"; the direct APIs are their own vendor
    const modelProvider = provider === "openrouter" ? modelSlug.split("/")[0] : provider;
    return {
      action,
      aiKeyLast4Digits: apiKey.slice(-4),
      modelProvider,
      aiProvider: provider,
      modelGatewayId: provider === "openrouter" ? modelSlug : `${provider}/${modelSlug}`,
      modelSlug,
      isGateway: false,
      modelObj: cloudModel(provider, apiKey, modelSlug),
    };
  }

  const modelConfig = await getModelConfigForOrg(orgId, action);
  if (!modelConfig) {
    throw new Error(`No model configured for action "${action}"`);
  }
  const modelGatewayId = buildGatewayModelId(modelConfig.modelProvider, modelConfig.modelSlug);
  const gateway = createGateway({ apiKey });

  return {
    action,
    aiKeyLast4Digits: apiKey.slice(-4),
    modelProvider: modelConfig.modelProvider,
    aiProvider: DEFAULT_AI_PROVIDER,
    modelGatewayId,
    modelSlug: modelConfig.modelSlug,
    isGateway: true,
    gatewayApiKey: apiKey,
    modelObj: gateway(modelGatewayId),
    providerOptions: modelConfig.providerOptions as ProviderOptions,
  };
}
