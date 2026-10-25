import { and, eq } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { quickAccessTbl } from "../../schemas/quick-access";

/**
 * Delete a quick access item for a user in an organization
 */
export async function deleteQuickAccess(
  orgId: string,
  userId: string,
  appId: string,
  appType: "system" | "mini_app"
): Promise<void> {
  await zdocsDb
    .delete(quickAccessTbl)
    .where(
      and(
        eq(quickAccessTbl.orgId, orgId),
        eq(quickAccessTbl.userId, userId),
        eq(quickAccessTbl.appId, appId),
        eq(quickAccessTbl.appType, appType)
      )
    );
}
