import { zdocsDb } from "../db";
import { aiUsageLogsTbl } from "../schemas/ai";
import { organizationsTbl } from "../schemas/organizations";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import type {
  AiUsageEntityType,
  ModelResult,
} from "@zdocs/types";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MILLI_CENTS_PER_DOLLAR = 100_000;

// ═══════════════════════════════════════════════════════════════════════════════
// AI PRICING - from ai-pricing.ts
// ═══════════════════════════════════════════════════════════════════════════════

interface ModelPricing {
  inputPricePerMillion: number;
  cachedPricePerMillion?: number;
  outputPricePerMillion: number;
}

/** Model pricing lookup table (prices per million tokens in USD) */
const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-3-flash-preview": {
    inputPricePerMillion: 0.5,
    cachedPricePerMillion: 0.05,
    outputPricePerMillion: 3,
  },
  "gemini-3.1-pro-preview": {
    inputPricePerMillion: 2,
    cachedPricePerMillion: 0.2,
    outputPricePerMillion: 12,
  },
  "gemini-3-pro-preview": {
    inputPricePerMillion: 2,
    cachedPricePerMillion: 0.2,
    outputPricePerMillion: 12,
  },
  "gemini-2.5-flash": {
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 2.5,
  },
  "gemini-2.5-flash-lite": {
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
  },
  "gemini-2.5-pro": {
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 2.5,
  },
  "claude-opus-4-5-20251101": {
    inputPricePerMillion: 5,
    cachedPricePerMillion: 0.5,
    outputPricePerMillion: 25,
  },
};

/**
 * Calculate the cost in milli-cents for a given model and token usage
 * Returns integer milli-cents (1 cent = 1,000 milli-cents, $1.00 = 100,000 milli-cents)
 * 
 * @param model - Model name (e.g., "gemini-2.5-flash")
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param cachedTokens - Number of cached tokens (optional)
 * @returns Cost in milli-cents
 */
export function calculateCostMilliCent(
  modelSlug: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens?: number
): number {
  const pricing = MODEL_PRICING[modelSlug] || MODEL_PRICING["gemini-2.5-flash"];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const cachedCost =
    cachedTokens && pricing.cachedPricePerMillion
      ? (cachedTokens / 1_000_000) * pricing.cachedPricePerMillion
      : 0;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  const totalCostDollars = inputCost + cachedCost + outputCost;
  return Math.ceil(totalCostDollars * MILLI_CENTS_PER_DOLLAR);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Usage object from AI SDK (e.g., from generateObject, streamText)
 */
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
  responseObj?: any; // Full response object from AI SDK (contains providerMetadata.gateway.cost for gateway requests)
  entityId?: string;
  entityType?: AiUsageEntityType;
  pageNumber?: number;
  pageCount?: number;
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface LogAiUsageResult {
  costMilliCent: number; // Raw AI cost
}

/**
 * Log an AI usage event to the database
 *
 * @param params - The usage parameters to log
 * @returns The cost of the call
 */
export async function logAiUsage(params: LogAiUsageParams): Promise<LogAiUsageResult> {
  const {
    orgId,
    modelResult,
    usage,
    responseObj,
    entityId,
    entityType,
    pageNumber,
    pageCount,
    metadata,
  } = params;

  // Extract fields from modelResult
  const {
    action,
    aiKeyLast4Digits,
    modelProvider,
    aiProvider,
    modelGatewayId,
    modelSlug,
    isGateway,
  } = modelResult;

  // Extract and calculate token values uniformly
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = (usage.outputTokens ?? 0) + (usage.reasoningTokens ?? 0);
  const cachedTokens = usage.cachedInputTokens ?? 0;
  const reasoningTokens = usage.reasoningTokens ?? 0;
  const totalTokens = usage.totalTokens ?? 0;


  // Calculate raw cost based on model and token usage (in milli-cents)
  // Prefer Vercel Gateway actual cost when available from responseObj
  const localCostMilliCent = calculateCostMilliCent(
    modelSlug,
    inputTokens,
    outputTokens,
    cachedTokens
  );
  let costMilliCent = localCostMilliCent;

  // console.log("isGateway: ", isGateway);
  // console.log("responseObj?.body?.providerMetadata?.gateway: ", responseObj?.body?.providerMetadata?.gateway);

  // Extract gateway cost from responseObj if available
  if (isGateway && responseObj?.body?.providerMetadata?.gateway?.cost) {
    const gatewayCostUsd = responseObj.body?.providerMetadata.gateway.cost;
    console.log("gatewayCostUsd: ", gatewayCostUsd);
    if (typeof gatewayCostUsd === "number") {
      costMilliCent = Math.ceil(gatewayCostUsd * MILLI_CENTS_PER_DOLLAR);
      console.log(
        `AI Usage: using gateway cost $${gatewayCostUsd.toFixed(6)} ` +
        `(local estimate was $${(localCostMilliCent / MILLI_CENTS_PER_DOLLAR).toFixed(6)}) ` +
        `for generation ${responseObj?.id || "unknown"}`
      );
    }
  }

  try {
    await zdocsDb.insert(aiUsageLogsTbl).values({
      orgId,
      action,
      modelGatewayId,
      modelSlug,
      modelProvider,
      aiProvider,
      aiKeyLast4Digits: aiKeyLast4Digits,
      isGateway,
      inputTokens,
      outputTokens,
      cachedTokens: cachedTokens ?? null,
      costMilliCent: costMilliCent, // Raw AI cost
      entityId: entityId ?? null,
      entityType: entityType ?? null,
      pageNumber: pageNumber ?? null,
      metadata: {
        ...metadata,
        usage,
        pageCount: pageCount ?? null,
        gatewayMetadata: responseObj?.body?.providerMetadata?.gateway || null,
      },
    });

    const costDisplay = costMilliCent / MILLI_CENTS_PER_DOLLAR;

    console.log(
      `AI Usage logged: ${action} using ${modelGatewayId} - ${inputTokens} input, ${outputTokens} output tokens, ${reasoningTokens} reasoning tokens, ${totalTokens} total tokens, cost: $${costDisplay.toFixed(6)}`
    );
  } catch (error) {
    // Log error but don't throw - we don't want usage logging to break the main flow
    console.error("Failed to log AI usage:", error);
  }

  return { costMilliCent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AiUsageStats {
  orgId: string;
  orgName: string;
  totalRequests: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byAction: Array<{
    action: string;
    count: number;
    cost: number;
  }>;
  byModel: Array<{
    modelGatewayId: string;
    count: number;
    cost: number;
  }>;
}

export interface GetAiUsageStatsParams {
  startDate?: Date;
  endDate?: Date;
  orgId?: string;
}

/**
 * Get AI usage statistics for admin dashboard
 * Can filter by date range and/or organization
 */
export async function getAiUsageStats(
  params: GetAiUsageStatsParams = {}
): Promise<AiUsageStats[]> {
  const { startDate, endDate, orgId } = params;

  // Build where conditions
  const conditions = [];
  if (orgId) {
    conditions.push(eq(aiUsageLogsTbl.orgId, orgId));
  }
  if (startDate) {
    conditions.push(gte(aiUsageLogsTbl.timestamp, startDate));
  }
  if (endDate) {
    conditions.push(lte(aiUsageLogsTbl.timestamp, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get usage grouped by organization
  const orgUsage = await zdocsDb
    .select({
      orgId: aiUsageLogsTbl.orgId,
      totalRequests: sql<number>`count(*)::int`,
      totalCost: sql<number>`sum(${aiUsageLogsTbl.costMilliCent})::float`,
      totalInputTokens: sql<number>`sum(${aiUsageLogsTbl.inputTokens})::int`,
      totalOutputTokens: sql<number>`sum(${aiUsageLogsTbl.outputTokens})::int`,
    })
    .from(aiUsageLogsTbl)
    .where(whereClause)
    .groupBy(aiUsageLogsTbl.orgId);

  // Get organization names
  const orgIds = orgUsage.map((u) => u.orgId);
  const orgs =
    orgIds.length > 0
      ? await zdocsDb
        .select({
          id: organizationsTbl.id,
          name: organizationsTbl.name,
        })
        .from(organizationsTbl)
        .where(inArray(organizationsTbl.id, orgIds))
      : [];

  const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

  // Get stats by action and model for each org
  const statsPromises = orgUsage.map(async (org) => {
    const orgWhere = and(
      eq(aiUsageLogsTbl.orgId, org.orgId),
      ...(whereClause ? [whereClause] : [])
    );

    // By action
    const byAction = await zdocsDb
      .select({
        action: aiUsageLogsTbl.action,
        count: sql<number>`count(*)::int`,
        cost: sql<number>`sum(${aiUsageLogsTbl.costMilliCent})::float`,
      })
      .from(aiUsageLogsTbl)
      .where(orgWhere)
      .groupBy(aiUsageLogsTbl.action)
      .orderBy(desc(sql`count(*)`));

    // By model
    const byModel = await zdocsDb
      .select({
        modelGatewayId: aiUsageLogsTbl.modelGatewayId,
        count: sql<number>`count(*)::int`,
        cost: sql<number>`sum(${aiUsageLogsTbl.costMilliCent})::float`,
      })
      .from(aiUsageLogsTbl)
      .where(orgWhere)
      .groupBy(aiUsageLogsTbl.modelGatewayId)
      .orderBy(desc(sql`sum(${aiUsageLogsTbl.costMilliCent})`));

    return {
      orgId: org.orgId,
      orgName: orgMap.get(org.orgId) || "Unknown",
      totalRequests: org.totalRequests,
      totalCost: (Number(org.totalCost) || 0) / MILLI_CENTS_PER_DOLLAR, // Convert milli-cents to dollars
      totalInputTokens: Number(org.totalInputTokens) || 0,
      totalOutputTokens: Number(org.totalOutputTokens) || 0,
      byAction: byAction.map((a) => ({
        action: a.action,
        count: a.count,
        cost: (Number(a.cost) || 0) / MILLI_CENTS_PER_DOLLAR, // Convert milli-cents to dollars
      })),
      byModel: byModel.map((m) => ({
        modelGatewayId: m.modelGatewayId,
        count: m.count,
        cost: (Number(m.cost) || 0) / MILLI_CENTS_PER_DOLLAR, // Convert milli-cents to dollars
      })),
    };
  });

  return Promise.all(statsPromises);
}
