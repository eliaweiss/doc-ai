import { eq, desc } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { miniAppsTbl } from "../../schemas/mini-apps";
import type { MiniApp } from "@zdocs/types";

/**
 * List all mini apps for an organization
 */
export async function listMiniAppsForOrg(orgId: string): Promise<MiniApp[]> {
  const results = await zdocsDb
    .select()
    .from(miniAppsTbl)
    .where(eq(miniAppsTbl.orgId, orgId))
    .orderBy(desc(miniAppsTbl.updatedAt));

  return results;
}
