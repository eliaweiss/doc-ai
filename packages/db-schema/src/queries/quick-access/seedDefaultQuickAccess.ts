import { createQuickAccess } from "./createQuickAccess";
import { DEFAULT_ENABLED_SYSTEM_APP_IDS, type QuickAccessItem } from "@zdocs/types";

/**
 * Seed default quick access items for a user in an organization.
 * Called when a user has no quick access items yet (new org or new user).
 */
export async function seedDefaultQuickAccess(
  orgId: string,
  userId: string
): Promise<QuickAccessItem[]> {
  const items: QuickAccessItem[] = [];

  for (let i = 0; i < DEFAULT_ENABLED_SYSTEM_APP_IDS.length; i++) {
    const item = await createQuickAccess({
      orgId,
      userId,
      appId: DEFAULT_ENABLED_SYSTEM_APP_IDS[i],
      appType: "system",
      displayOrder: i,
    });
    items.push(item);
  }

  return items;
}
