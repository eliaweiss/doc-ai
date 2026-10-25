import { eq, and } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { miniAppsTbl } from "../../schemas/mini-apps";
import type { MiniApp } from "@zdocs/types";

/**
 * Get a mini app by ID, scoped to org
 */
export async function getMiniAppForOrg(
  orgId: string,
  appId: string
): Promise<MiniApp | null> {
  const results = await zdocsDb
    .select()
    .from(miniAppsTbl)
    .where(and(eq(miniAppsTbl.id, appId), eq(miniAppsTbl.orgId, orgId)))
    .limit(1);

  return results[0] || null;
}
