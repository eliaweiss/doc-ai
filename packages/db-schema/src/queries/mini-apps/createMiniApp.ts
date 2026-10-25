import { zdocsDb } from "../../db";
import { miniAppsTbl } from "../../schemas/mini-apps";
import type { CreateMiniAppParams, MiniApp } from "@zdocs/types";
import { createMiniAppHistory } from "../mini-apps-history/createMiniAppHistory";

/**
 * Create a new mini app for an organization
 */
export async function createMiniApp(
  params: CreateMiniAppParams
): Promise<MiniApp> {
  const { orgId, userId, name, description, color, icon, code, isPublished } = params;

  const results = await zdocsDb
    .insert(miniAppsTbl)
    .values({
      orgId,
      userId,
      name,
      description: description || null,
      color: color || null,
      icon: icon || null,
      code,
      isPublished: isPublished || false,
    })
    .returning();

  const miniApp = results[0];

  // Create history entry for the initial creation
  await createMiniAppHistory(miniApp).catch((error) => {
    console.error(
      `Failed to create history entry for mini app ${miniApp.id}:`,
      error
    );
    // Don't fail the creation if history fails
  });

  return miniApp;
}
