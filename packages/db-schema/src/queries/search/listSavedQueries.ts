import { zdocsDb } from "../../db";
import { savedQueryTbl } from "../../schemas/search";
import { eq, and, desc } from "drizzle-orm";
import type { SavedQuery } from "@zdocs/types";

export async function listSavedQueries(
  orgId: string,
  userId: string
): Promise<SavedQuery[]> {
  const results = await zdocsDb
    .select()
    .from(savedQueryTbl)
    .where(
      and(eq(savedQueryTbl.orgId, orgId), eq(savedQueryTbl.userId, userId))
    )
    .orderBy(desc(savedQueryTbl.createdAt));

  return results;
}

