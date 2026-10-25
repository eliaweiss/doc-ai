import { and, eq, inArray } from "drizzle-orm";
import { zdocsDb } from "../../db";
import { quickAccessTbl } from "../../schemas/quick-access";
import type { QuickAccessItem } from "@zdocs/types";

/**
 * Reorder quick access items for a user in an organization
 * @param orgId Organization ID
 * @param userId User ID
 * @param itemIds Array of item IDs in the new order
 */
export async function reorderQuickAccess(
  orgId: string,
  userId: string,
  itemIds: string[]
): Promise<QuickAccessItem[]> {
  if (itemIds.length === 0) {
    return [];
  }

  // Verify all items belong to this user and org
  const existingItems = await zdocsDb
    .select()
    .from(quickAccessTbl)
    .where(
      and(
        eq(quickAccessTbl.orgId, orgId),
        eq(quickAccessTbl.userId, userId),
        inArray(quickAccessTbl.id, itemIds)
      )
    );

  if (existingItems.length !== itemIds.length) {
    throw new Error("Some items not found or don't belong to user");
  }

  // Update displayOrder for each item based on its position in the array
  const results: QuickAccessItem[] = [];
  for (let index = 0; index < itemIds.length; index++) {
    const id = itemIds[index];
    const [result] = await zdocsDb
      .update(quickAccessTbl)
      .set({
        displayOrder: index,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(quickAccessTbl.id, id),
          eq(quickAccessTbl.orgId, orgId),
          eq(quickAccessTbl.userId, userId)
        )
      )
      .returning();

    if (result) {
      results.push(result);
    }
  }

  return results.sort((a, b) => a.displayOrder - b.displayOrder);
}
