import { zdocsDb } from "../../db";
import { miniAppsHistoryTbl } from "../../schemas/mini-apps-history";
import type { MiniAppHistory, MiniApp } from "@zdocs/types";

/**
 * Create a history entry for a mini app
 * Called after create or update operations
 */
export async function createMiniAppHistory(
  miniApp: MiniApp
): Promise<MiniAppHistory> {
  const results = await zdocsDb
    .insert(miniAppsHistoryTbl)
    .values({
      miniAppId: miniApp.id,
      orgId: miniApp.orgId,
      userId: miniApp.userId,
      name: miniApp.name,
      description: miniApp.description,
      color: miniApp.color,
      icon: miniApp.icon,
      code: miniApp.code,
      isPublished: miniApp.isPublished,
    })
    .returning();

  return results[0];
}
