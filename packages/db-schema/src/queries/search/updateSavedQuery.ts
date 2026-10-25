import { zdocsDb } from "../../db";
import { savedQueryTbl } from "../../schemas/search";
import { eq, and } from "drizzle-orm";
import type { SavedQuery } from "@zdocs/types";
import type { UpdateSavedQueryParams } from "@zdocs/types";

export async function updateSavedQuery(
  params: UpdateSavedQueryParams
): Promise<SavedQuery | null> {
  const { id, orgId, userId, ...updates } = params;

  const updateData: Partial<typeof savedQueryTbl.$inferInsert> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.query !== undefined) updateData.query = updates.query;
  if (updates.filters !== undefined) updateData.filters = updates.filters;
  updateData.updatedAt = new Date();

  const [result] = await zdocsDb
    .update(savedQueryTbl)
    .set(updateData)
    .where(
      and(
        eq(savedQueryTbl.id, id),
        eq(savedQueryTbl.orgId, orgId),
        eq(savedQueryTbl.userId, userId)
      )
    )
    .returning();

  return result ?? null;
}
