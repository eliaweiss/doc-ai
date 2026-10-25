import { and, eq, desc } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { quickAccessTbl } from "../../schemas/quick-access";
import type { CreateQuickAccessParams, QuickAccessItem } from "@zdocs/types";

/**
 * Create a quick access item for a user in an organization
 */
export async function createQuickAccess(
  params: CreateQuickAccessParams
): Promise<QuickAccessItem> {
  // Check if already exists
  const existing = await zdocsDb
    .select()
    .from(quickAccessTbl)
    .where(
      and(
        eq(quickAccessTbl.orgId, params.orgId),
        eq(quickAccessTbl.userId, params.userId),
        eq(quickAccessTbl.appId, params.appId),
        eq(quickAccessTbl.appType, params.appType)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Get max display order for this user
  const maxOrder = await zdocsDb
    .select()
    .from(quickAccessTbl)
    .where(
      and(
        eq(quickAccessTbl.orgId, params.orgId),
        eq(quickAccessTbl.userId, params.userId)
      )
    )
    .orderBy(desc(quickAccessTbl.displayOrder))
    .limit(1);

  const displayOrder =
    params.displayOrder !== undefined
      ? params.displayOrder
      : maxOrder.length > 0
        ? maxOrder[0].displayOrder + 1
        : 0;

  const [result] = await zdocsDb
    .insert(quickAccessTbl)
    .values({
      orgId: params.orgId,
      userId: params.userId,
      appId: params.appId,
      appType: params.appType,
      displayOrder,
    })
    .returning();

  return result;
}
