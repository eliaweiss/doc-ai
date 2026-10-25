import { zdocsDb } from "../../db";
import { savedQueryTbl } from "../../schemas/search";
import { eq, and } from "drizzle-orm";
import type { SavedQuery } from "@zdocs/types";

export async function getSavedQueryById(
  id: string,
  orgId: string,
  userId: string
): Promise<SavedQuery | null> {
  const [result] = await zdocsDb
    .select()
    .from(savedQueryTbl)
    .where(
      and(
        eq(savedQueryTbl.id, id),
        eq(savedQueryTbl.orgId, orgId),
        eq(savedQueryTbl.userId, userId)
      )
    )
    .limit(1);

  return result ?? null;
}

