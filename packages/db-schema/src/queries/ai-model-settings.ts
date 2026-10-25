/**
 * doc-ai: per-action model selection (Settings → Processing).
 */
import { eq, sql } from "drizzle-orm";
import { zdocsDb } from "../db";
import { aiModelSettingsTbl } from "../schemas/ai-model-settings";
import type { AiUsageAction } from "@zdocs/types";

export interface AiModelSelection {
  modelProvider: string;
  modelSlug: string;
}

export type AiModelSelections = Partial<Record<AiUsageAction, AiModelSelection>>;

export async function getAiModelSelectionsForOrg(orgId: string): Promise<AiModelSelections> {
  const rows = await zdocsDb
    .select()
    .from(aiModelSettingsTbl)
    .where(eq(aiModelSettingsTbl.orgId, orgId));
  const selections: AiModelSelections = {};
  for (const row of rows) {
    selections[row.action as AiUsageAction] = {
      modelProvider: row.modelProvider,
      modelSlug: row.modelSlug,
    };
  }
  return selections;
}

/** Upsert the given actions; actions not passed are left as they are. */
export async function setAiModelSelectionsForOrg(
  orgId: string,
  selections: AiModelSelections
): Promise<void> {
  const values = Object.entries(selections).map(([action, s]) => ({
    orgId,
    action,
    modelProvider: s!.modelProvider,
    modelSlug: s!.modelSlug,
  }));
  if (values.length === 0) return;
  await zdocsDb
    .insert(aiModelSettingsTbl)
    .values(values)
    .onConflictDoUpdate({
      target: [aiModelSettingsTbl.orgId, aiModelSettingsTbl.action],
      set: {
        modelProvider: sql`excluded.model_provider`,
        modelSlug: sql`excluded.model_slug`,
        updatedAt: sql`now()`,
      },
    });
}
