/**
 * doc-ai: logs AI usage to ai_usage_logs (zdocs deducted credits here; doc-ai has none).
 */
import { logAiUsage as logAiUsageDb, type LogAiUsageResult } from "@zdocs/db-schema";
import type { AiUsageEntityType, ModelResult } from "@zdocs/types";

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
}

export interface LogAiUsageParams {
  orgId: string;
  modelResult: ModelResult;
  usage: AiUsage;
  responseObj?: any;
  entityId?: string;
  entityType?: AiUsageEntityType;
  pageNumber?: number;
  pageCount?: number;
  metadata?: Record<string, any>;
}

export async function logAiUsage(
  params: LogAiUsageParams
): Promise<LogAiUsageResult | null> {
  try {
    return await logAiUsageDb(params);
  } catch (error) {
    // Usage logging must never fail a pipeline step
    console.error("[AI Usage] Failed to log usage:", error);
    return null;
  }
}
