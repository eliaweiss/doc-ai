import type { AiUsageAction, ModelConfig } from "@zdocs/types";
import { AI_MODEL_MAP } from "@zdocs/types";
import type { streamText } from "ai";

// Extract ProviderOptions type from streamText function signature
type ProviderOptions = Parameters<typeof streamText>[0]["providerOptions"];

// Re-export types and data from the shared types package
export type { ModelConfig };
export { AI_MODEL_MAP, AI_PROVIDER_LABELS, AI_PROVIDER_KEYS } from "@zdocs/types";

/**
 * Providers that have direct SDK support (not virtual providers)
 */
export const DIRECT_PROVIDERS = ["google", "openai", "anthropic"] as const;

/**
 * Check if an AI provider is a virtual provider (not in DIRECT_PROVIDERS)
 */
export function isVirtualProvider(aiProvider: string): boolean {
  return !DIRECT_PROVIDERS.includes(aiProvider as (typeof DIRECT_PROVIDERS)[number]);
}

/**
 * Get the model configuration for a given provider and action
 */
export function getModelConfigForAction(
  aiProvider: string,
  action: AiUsageAction
): ModelConfig {
  return AI_MODEL_MAP[aiProvider][action];
}

/**
 * Get the model name for a given provider and action
 */
export function getModelSlugForAction(aiProvider: string, action: AiUsageAction): string {
  return AI_MODEL_MAP[aiProvider][action].modelSlug;
}

/**
 * Build a gateway model ID string for AI Gateway routing
 * Format: "modelProvider/modelSlug" (e.g., "google/gemini-3-flash-preview")
 */
export function buildGatewayModelId(modelProvider: string, modelSlug: string): string {
  return `${modelProvider}/${modelSlug}`;
}
