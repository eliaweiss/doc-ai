import { zFetch } from "../../lib/utils";
import type { QuickAccessItem } from "@zdocs/types";

export interface EnableAppParams {
  orgId: string;
  appId: string;
  appType: "system" | "mini_app";
}

export interface DisableAppParams {
  orgId: string;
  appId: string;
  appType: "system" | "mini_app";
}

/**
 * List quick access items for an organization
 */
export async function listQuickAccess(orgId: string): Promise<QuickAccessItem[]> {
  const data = (await zFetch(
    `/api/org/${orgId}/quick-access`
  )) as { items: QuickAccessItem[] };
  return data.items;
}

/**
 * Enable an app in quick access
 */
export async function enableApp(params: EnableAppParams): Promise<QuickAccessItem> {
  const data = (await zFetch(
    `/api/org/${params.orgId}/quick-access`,
    {
      method: "POST",
      body: {
        appId: params.appId,
        appType: params.appType,
      },
    }
  )) as { item: QuickAccessItem };
  return data.item;
}

/**
 * Disable an app in quick access
 */
export async function disableApp(params: DisableAppParams): Promise<void> {
  await zFetch(
    `/api/org/${params.orgId}/quick-access?appId=${params.appId}&appType=${params.appType}`,
    {
      method: "DELETE",
    }
  );
}

export interface ReorderQuickAccessParams {
  orgId: string;
  itemIds: string[];
}

/**
 * Reorder quick access items
 */
export async function reorderQuickAccess(
  params: ReorderQuickAccessParams
): Promise<QuickAccessItem[]> {
  const data = (await zFetch(
    `/api/org/${params.orgId}/quick-access`,
    {
      method: "PATCH",
      body: {
        itemIds: params.itemIds,
      },
    }
  )) as { items: QuickAccessItem[] };
  return data.items;
}
