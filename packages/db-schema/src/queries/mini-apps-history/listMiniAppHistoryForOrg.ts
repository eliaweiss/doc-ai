import { eq, and, desc } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { miniAppsHistoryTbl } from "../../schemas/mini-apps-history";
import type { MiniAppHistory } from "@zdocs/types";

/**
 * List history entries for a mini app, scoped to org
 * Returns entries in descending order (newest first)
 */
export async function listMiniAppHistoryForOrg(
  orgId: string,
  miniAppId: string
): Promise<MiniAppHistory[]> {
  const results = await zdocsDb
    .select()
    .from(miniAppsHistoryTbl)
    .where(
      and(
        eq(miniAppsHistoryTbl.orgId, orgId),
        eq(miniAppsHistoryTbl.miniAppId, miniAppId)
      )
    )
    .orderBy(desc(miniAppsHistoryTbl.createdAt));

  return results;
}
