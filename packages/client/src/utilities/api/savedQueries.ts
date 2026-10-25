import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import type { SavedQuery, SavedQueryFilters } from "@zdocs/types";

interface ListSavedQueriesResponse {
  queries: SavedQuery[];
}

interface CreateSavedQueryRequest {
  name: string;
  query: string;
  filters: SavedQueryFilters | null;
}

interface UpdateSavedQueryRequest {
  name?: string;
  query?: string;
  filters?: SavedQueryFilters | null;
}

/**
 * List all saved queries for the current user
 */
export async function listSavedQueriesApi(): Promise<SavedQuery[]> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${orgId}/saved-queries`,
    { method: "GET" }
  );
  return response.queries;
}

/**
 * Create a new saved query
 */
export async function createSavedQueryApi(
  request: CreateSavedQueryRequest
): Promise<SavedQuery> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(`/api/org/${orgId}/saved-queries`, {
    method: "POST",
    body: request,
  });
}

/**
 * Get a single saved query by ID
 */
export async function getSavedQueryApi(queryId: string): Promise<SavedQuery> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(`/api/org/${orgId}/saved-queries/${queryId}`, {
    method: "GET",
  });
}

/**
 * Update a saved query
 */
export async function updateSavedQueryApi(
  queryId: string,
  request: UpdateSavedQueryRequest
): Promise<SavedQuery> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(`/api/org/${orgId}/saved-queries/${queryId}`, {
    method: "PATCH",
    body: request,
  });
}

/**
 * Delete a saved query
 */
export async function deleteSavedQueryApi(queryId: string): Promise<void> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  await zFetch(`/api/org/${orgId}/saved-queries/${queryId}`, {
    method: "DELETE",
  });
}
