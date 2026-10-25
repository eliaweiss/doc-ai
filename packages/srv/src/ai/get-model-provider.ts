/**
 * doc-ai: config-driven replacement for zdocs' billing-aware getModelProviderForOrg.
 * Same signature and result shape; orgId is ignored (single local org).
 *
 * - gateway: Vercel AI Gateway, model per action from Settings (ai_model_settings
 *            table), falling back to AI_MODEL_MAP[DEFAULT_AI_PROVIDER][action]
 * - ollama:  Ollama's OpenAI-compatible /v1 endpoint, one model for every action
 */
import { createGateway } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { streamText } from "ai";
import { DEFAULT_AI_PROVIDER, type AiUsageAction, type ModelResult } from "@zdocs/types";
import { getAiModelSelectionsForOrg } from "@zdocs/db-schema";
import { getModelConfigForAction, buildGatewayModelId, type ModelConfig } from "./ai-model-config";
import { AiKeyError } from "./detect-api-key-error";
import { getConfig } from "../local/config";

type ProviderOptions = Parameters<typeof streamText>[0]["providerOptions"];

export interface ModelProviderResult extends ModelResult {
  modelObj: any;
  providerOptions?: ProviderOptions;
}

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

export async function getModelProviderForOrg(
  orgId: string,
  action: AiUsageAction
): Promise<ModelProviderResult> {
  const config = getConfig();

  if (config.provider === "ollama") {
    const ollama = createOpenAI({
      baseURL: `${config.ollamaBaseUrl.replace(/\/$/, "")}/v1`,
      apiKey: "ollama",
    });
    return {
      action,
      aiKeyLast4Digits: "",
      modelProvider: "ollama",
      aiProvider: "ollama",
      modelGatewayId: `ollama/${config.ollamaModel}`,
      modelSlug: config.ollamaModel,
      isGateway: false,
      modelObj: ollama.chat(config.ollamaModel),
    };
  }

  if (!config.gatewayApiKey) {
    throw new AiKeyError(
      "AI_GATEWAY_API_KEY is not set. Set it, or use DOC_AI_PROVIDER=ollama.",
      "NO_KEY"
    );
  }

  const modelConfig = await getModelConfigForOrg(orgId, action);
  if (!modelConfig) {
    throw new Error(`No model configured for action "${action}"`);
  }
  const modelGatewayId = buildGatewayModelId(modelConfig.modelProvider, modelConfig.modelSlug);
  const gateway = createGateway({ apiKey: config.gatewayApiKey });

  return {
    action,
    aiKeyLast4Digits: config.gatewayApiKey.slice(-4),
    modelProvider: modelConfig.modelProvider,
    aiProvider: DEFAULT_AI_PROVIDER,
    modelGatewayId,
    modelSlug: modelConfig.modelSlug,
    isGateway: true,
    gatewayApiKey: config.gatewayApiKey,
    modelObj: gateway(modelGatewayId),
    providerOptions: modelConfig.providerOptions as ProviderOptions,
  };
}
