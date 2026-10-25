import { zdocsDb } from "../../db";
import { savedQueryTbl } from "../../schemas/search";
import type { SavedQuery } from "@zdocs/types";
import type { CreateSavedQueryParams } from "@zdocs/types";

export async function createSavedQuery(
  params: CreateSavedQueryParams
): Promise<SavedQuery> {
  const { orgId, userId, name, query, filters } = params;

  const [result] = await zdocsDb
    .insert(savedQueryTbl)
    .values({
      orgId,
      userId,
      name,
      query,
      filters,
    })
    .returning();

  return result;
}
