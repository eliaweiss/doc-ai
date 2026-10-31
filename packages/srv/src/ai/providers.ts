/**
 * doc-ai: the AI setups the setup wizard offers, and their defaults.
 *
 * - ollama:     Qwen 3.5 9B (or any vision model) on the user's Ollama
 * - local:      Qwen 3.5 9B that doc-ai downloads and runs itself (llama.cpp's llama-server)
 * - gateway:    Vercel AI Gateway, model per step from the ai_model_settings table
 * - openrouter, openai, anthropic, google: the provider's own API with the user's key
 */
export const PROVIDER_KINDS = [
  "ollama",
  "local",
  "gateway",
  "openrouter",
  "openai",
  "anthropic",
  "google",
] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

/** Setups that need an API key */
export const KEY_PROVIDERS = ["gateway", "openrouter", "openai", "anthropic", "google"] as const;
export type KeyProvider = (typeof KEY_PROVIDERS)[number];

/** Setups whose models are chosen in the wizard (one for classification, one for extraction) */
export const CLOUD_PROVIDERS = ["openrouter", "openai", "anthropic", "google"] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export interface StepModels {
  classify: string;
  extract: string;
}

/** Environment variable each key falls back to when none is saved */
export const KEY_ENV_VARS: Record<KeyProvider, string> = {
  gateway: "AI_GATEWAY_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

/** A cheap, fast model for classification and a stronger one for extraction */
export const DEFAULT_CLOUD_MODELS: Record<CloudProvider, StepModels> = {
  openrouter: { classify: "google/gemini-3.5-flash-lite", extract: "google/gemini-3.8-flash" },
  openai: { classify: "gpt-6-luna", extract: "gpt-6.1-terra" },
  anthropic: { classify: "claude-haiku-5-5", extract: "claude-sonnet-5-5" },
  google: { classify: "gemini-3.5-flash-lite", extract: "gemini-3.8-flash" },
};

export const DEFAULT_OLLAMA_MODEL = "qwen3.5:9b";

export const isProviderKind = (value: unknown): value is ProviderKind =>
  (PROVIDER_KINDS as readonly unknown[]).includes(value);
export const isKeyProvider = (value: unknown): value is KeyProvider =>
  (KEY_PROVIDERS as readonly unknown[]).includes(value);
export const isCloudProvider = (value: unknown): value is CloudProvider =>
  (CLOUD_PROVIDERS as readonly unknown[]).includes(value);
