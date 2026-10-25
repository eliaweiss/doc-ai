import useOrgStore from "../../context-providers/orgStore";
import { zFetch } from "../../lib/utils";
import type { MiniApp, MiniAppHistory, CreateMiniAppParams, UpdateMiniAppParams } from "@zdocs/types";

export interface CreateMiniAppResponse {
  miniApp: MiniApp;
}

export interface GetMiniAppResponse {
  miniApp: MiniApp;
}

export interface ListMiniAppsResponse {
  miniApps: MiniApp[];
}

/**
 * Create a new Mini App
 */
export async function createMiniAppApi(
  orgId: string,
  params: Omit<CreateMiniAppParams, "orgId">
): Promise<MiniApp> {
  const response = await zFetch(`/api/org/${orgId}/mini-apps/create`, {
    method: "POST",
    body: params,
  });
  return response.miniApp;
}

/**
 * Load an existing Mini App
 */
export async function loadMiniAppApi(
  orgId: string,
  miniAppId: string
): Promise<MiniApp> {
  const response = await zFetch(`/api/org/${orgId}/mini-apps/${miniAppId}`, {
    method: "POST",
  });
  return response.miniApp;
}

/**
 * List Mini Apps for an organization
 */
export async function listMiniAppsApi(orgId: string): Promise<MiniApp[]> {
  const response = await zFetch(`/api/org/${orgId}/mini-apps/list-miniapps`, {
    method: "POST",
  });
  return response.miniApps;
}

/**
 * Update a Mini App
 */
export async function updateMiniAppApi(
  orgId: string,
  miniAppId: string,
  params: UpdateMiniAppParams
): Promise<MiniApp> {
  const response = await zFetch(`/api/org/${orgId}/mini-apps/${miniAppId}`, {
    method: "PUT",
    body: params,
  });
  return response.miniApp;
}

/**
 * Delete a Mini App
 */
export async function deleteMiniAppApi(
  orgId: string,
  miniAppId: string
): Promise<void> {
  await zFetch(`/api/org/${orgId}/mini-apps/${miniAppId}`, {
    method: "DELETE",
  });
}

export interface GetMiniAppHistoryResponse {
  history: MiniAppHistory[];
}

/**
 * Get history for a Mini App
 */
export async function fetchMiniAppHistoryApi(
  orgId: string,
  miniAppId: string
): Promise<MiniAppHistory[]> {
  const response = await zFetch(
    `/api/org/${orgId}/mini-apps/${miniAppId}/history`,
    {
      method: "POST",
    }
  );
  return response.history;
}
