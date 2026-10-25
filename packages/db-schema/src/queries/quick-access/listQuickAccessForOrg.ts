import { and, eq, asc } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { quickAccessTbl } from "../../schemas/quick-access";
import type { QuickAccessItem } from "@zdocs/types";

/**
 * List all quick access items for a user in an organization
 */
export async function listQuickAccessForOrg(
  orgId: string,
  userId: string
): Promise<QuickAccessItem[]> {
  const results = await zdocsDb
    .select()
    .from(quickAccessTbl)
    .where(
      and(eq(quickAccessTbl.orgId, orgId), eq(quickAccessTbl.userId, userId))
    )
    .orderBy(asc(quickAccessTbl.displayOrder));

  return results;
}
