import type { AiUsageAction } from "./AiUsage";

export interface ModelConfig {
  modelSlug: string;
  modelProvider: string;
  providerOptions?: Record<string, unknown>;
}

export const DEFAULT_AI_PROVIDER = "geminiBuilder";

/**
 * Model mapping per provider per task.
 * This is the SINGLE source of truth for which model to use and its options.
 * Keys are AI provider profile names used in org billing settings.
 */
export const AI_MODEL_MAP: Record<string, Record<AiUsageAction, ModelConfig>> = {
  geminiBuilder: {
    CLASSIFY_DOCUMENT: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT_LITE: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    CHAT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    AI_BUILDER: {
      modelSlug: "gemini-3.1-pro-preview", modelProvider: "google",
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 8192, includeThoughts: true } },
      },
    },
    CATEGORY_MAPPING: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
  },
  geminiBuilder3_7_flash: {
    CLASSIFY_DOCUMENT: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT_LITE: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT: { modelSlug: "gemini-3.7-flash", modelProvider: "google" },
    CHAT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    AI_BUILDER: {
      modelSlug: "gemini-3.1-pro-preview", modelProvider: "google",
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 8192, includeThoughts: true } },
      },
    },
    CATEGORY_MAPPING: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
  },
  geminiBuilder3_1: {
    CLASSIFY_DOCUMENT: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT_LITE: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT: { modelSlug: "gemini-3.1-pro-preview", modelProvider: "google" },
    CHAT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    AI_BUILDER: {
      modelSlug: "gemini-3.1-pro-preview", modelProvider: "google",
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 8192, includeThoughts: true } },
      },
    },
    CATEGORY_MAPPING: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
  },
  codexBuilder: {
    CLASSIFY_DOCUMENT: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT_LITE: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT: { modelSlug: "gpt-5.3-codex", modelProvider: "openai" },
    CHAT: { modelSlug: "minimax-m2.5", modelProvider: "minimax" },
    AI_BUILDER: { modelSlug: "gpt-5.3-codex", modelProvider: "openai" },
    CATEGORY_MAPPING: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
  },
  minimaxBuilder: {
    CLASSIFY_DOCUMENT: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT_LITE: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    CHAT: { modelSlug: "minimax-m2.5", modelProvider: "minimax" },
    AI_BUILDER: { modelSlug: "minimax-m2.5", modelProvider: "minimax" },
    CATEGORY_MAPPING: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
  },
  google: {
    CLASSIFY_DOCUMENT: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT_LITE: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    CHAT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    AI_BUILDER: {
      modelSlug: "gemini-3-flash", modelProvider: "google",
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 8192 } },
      },
    },
    CATEGORY_MAPPING: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
  },
  sonnetBuilder: {
    CLASSIFY_DOCUMENT: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT_LITE: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
    EXTRACT_DOCUMENT: { modelSlug: "gemini-3-flash", modelProvider: "google" },
    CHAT: { modelSlug: "claude-sonnet-4.6", modelProvider: "anthropic" },
    AI_BUILDER: {
      modelSlug: "claude-sonnet-4.6", modelProvider: "anthropic",
      providerOptions: {
        anthropic: { thinking: { type: "enabled", budgetTokens: 10000 } },
      },
    },
    CATEGORY_MAPPING: { modelSlug: "gemini-2.5-flash-lite", modelProvider: "google" },
  },
};

/** Human-readable display names for each AI provider profile */
export const AI_PROVIDER_LABELS: Record<string, string> = {
  geminiBuilder: "Gemini Builder",
  codexBuilder: "Codex Builder",
  minimaxBuilder: "Minimax Builder",
  google: "Google",
  sonnetBuilder: "Sonnet Builder",
};

/** Ordered list of AI provider profile keys */
export const AI_PROVIDER_KEYS = Object.keys(AI_MODEL_MAP) as (keyof typeof AI_MODEL_MAP)[];
