import { eq, and } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { miniAppsTbl } from "../../schemas/mini-apps";

/**
 * Delete a mini app, scoped to org
 */
export async function deleteMiniAppForOrg(
  orgId: string,
  appId: string
): Promise<boolean> {
  const result = await zdocsDb
    .delete(miniAppsTbl)
    .where(and(eq(miniAppsTbl.id, appId), eq(miniAppsTbl.orgId, orgId)))
    .returning({ id: miniAppsTbl.id });

  return result.length > 0;
}
