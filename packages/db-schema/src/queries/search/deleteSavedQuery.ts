import { zdocsDb } from "../../db";
import { savedQueryTbl } from "../../schemas/search";
import { eq, and } from "drizzle-orm";

export async function deleteSavedQuery(
  id: string,
  orgId: string,
  userId: string
): Promise<boolean> {
  const result = await zdocsDb
    .delete(savedQueryTbl)
    .where(
      and(
        eq(savedQueryTbl.id, id),
        eq(savedQueryTbl.orgId, orgId),
        eq(savedQueryTbl.userId, userId)
      )
    )
    .returning({ id: savedQueryTbl.id });

  return result.length > 0;
}

