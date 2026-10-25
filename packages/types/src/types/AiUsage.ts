// Entity types that AI operations can be performed on
export const AI_USAGE_ENTITY_TYPES = [
  "DOCUMENT",
  "INVOICE",
  "CHAT_MESSAGE",
  "ALERT_RULE",
] as const;

export type AiUsageEntityType = (typeof AI_USAGE_ENTITY_TYPES)[number];

// Actions that consume AI tokens
export const AI_USAGE_ACTIONS = [
  "CLASSIFY_DOCUMENT",
  "EXTRACT_DOCUMENT",
  "EXTRACT_DOCUMENT_LITE",
  "CHAT", // AI Desk chat
  "AI_BUILDER", // Mini app code generation (also used for TASK_CODE)
  "CATEGORY_MAPPING",
] as const;

export type AiUsageAction = (typeof AI_USAGE_ACTIONS)[number];

// Alias for convenience (use AiUsageAction throughout)
export type AiAction = AiUsageAction;

/**
 * Model result fields needed for AI usage logging
 * Extracted from ModelProviderResult to avoid circular dependencies
 */
export interface ModelResult {
  action: AiUsageAction;
  aiKeyLast4Digits: string;
  modelProvider: string; // The actual underlying provider (e.g., "google", "minimax")
  aiProvider: string; // The selected AI profile/key (e.g., "aiGatewayFast", "google")
  modelGatewayId: string;
  modelSlug: string;
  isGateway: boolean; // Whether this request is routed through AI Gateway
  gatewayApiKey?: string; // The actual gateway API key used (for cost lookups)
}

/**
 * AI Usage Log record - tracks every AI interaction for cost analysis and debugging
 */
export interface AiUsageLog {
  id: string;
  orgId: string;
  timestamp: Date;
  action: string; // One of AI_USAGE_ACTIONS or custom action
  modelGatewayId: string; // e.g., "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"
  modelSlug: string; // e.g., "gemini-2.5-flash", "gemini-2.5-flash-lite"
  modelProvider: string; // e.g., "google", "openai", "anthropic"
  aiProvider: string; // The selected AI profile/key (e.g., "aiGatewayFast", "google")
  aiKeyLast4Digits: string; // Last 4 digits of the AI key used
  isGateway: boolean; // Whether this request was routed through AI Gateway
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number | null; // Tokens hit in cache (cheaper)
  costMilliCent: number; // Raw AI cost in milli-cents. $1 = 100,000
  appliedCostMilliCent: number | null; // Applied cost with org markup (null if not CREDIT_TOP_UP)
  entityId: string | null; // Related document or record ID
  entityType: string | null; // One of AI_USAGE_ENTITY_TYPES
  pageNumber: number | null; // Specific page involved (if applicable)
  createdAt: Date;
}

