import { eq, and } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { miniAppsTbl } from "../../schemas/mini-apps";
import type { UpdateMiniAppParams, MiniApp } from "@zdocs/types";
import { createMiniAppHistory } from "../mini-apps-history/createMiniAppHistory";

/**
 * Update a mini app, scoped to org
 */
export async function updateMiniAppForOrg(
  orgId: string,
  appId: string,
  params: UpdateMiniAppParams
): Promise<MiniApp | null> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.name !== undefined) updateData.name = params.name;
  if (params.description !== undefined)
    updateData.description = params.description;
  if (params.color !== undefined) updateData.color = params.color;
  if (params.icon !== undefined) updateData.icon = params.icon;
  // Only update code if it's provided and not null (code field is notNull() in DB)
  // Empty strings are allowed
  if (params.code !== undefined && params.code !== null) {
    updateData.code = params.code;
  }
  if (params.isPublished !== undefined)
    updateData.isPublished = params.isPublished;
  if (params.messages !== undefined) updateData.messages = params.messages;
  if (params.archived !== undefined)
    updateData.archivedAt = params.archived ? new Date() : null;
  
  const results = await zdocsDb
    .update(miniAppsTbl)
    .set(updateData)
    .where(and(eq(miniAppsTbl.id, appId), eq(miniAppsTbl.orgId, orgId)))
    .returning();

  const updatedMiniApp = results[0] || null;

  // Create history entry if update was successful
  if (updatedMiniApp) {
    await createMiniAppHistory(updatedMiniApp).catch((error) => {
      console.error(
        `Failed to create history entry for mini app ${appId}:`,
        error
      );
      // Don't fail the update if history fails
    });
  }

  return updatedMiniApp;
}
