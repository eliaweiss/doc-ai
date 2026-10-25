import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import type {
  SavedReconciliationSession,
  SearchableEntityOption,
  ReconciliationSessionOptions,
} from "@zdocs/types";


interface CreateSavedReconciliationSessionRequest {
  name: string;
  description?: string;
  sourceEntity: SearchableEntityOption;
  sourceQuery: string;
  sourceDateFrom?: string;
  sourceDateTo?: string;
  targetEntity: SearchableEntityOption;
  targetQuery: string;
  targetDateFrom?: string;
  targetDateTo?: string;
  amount?: string;
  currency?: string;
  options?: ReconciliationSessionOptions | null;
}

interface UpdateSavedReconciliationSessionRequest {
  name?: string;
  description?: string;
  sourceEntity?: SearchableEntityOption;
  sourceQuery?: string;
  sourceDateFrom?: string;
  sourceDateTo?: string;
  targetEntity?: SearchableEntityOption;
  targetQuery?: string;
  targetDateFrom?: string;
  targetDateTo?: string;
  amount?: string;
  currency?: string;
  options?: ReconciliationSessionOptions | null;
}

/**
 * List all saved reconciliation sessions for the current user
 */
export async function listSavedReconciliationSessionsApi(): Promise<
  SavedReconciliationSession[]
> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${orgId}/saved-reconciliation-sessions`,
    { method: "GET" }
  );
  return response.sessions;
}

/**
 * Create a new saved reconciliation session
 */
export async function createSavedReconciliationSessionApi(
  request: CreateSavedReconciliationSessionRequest
): Promise<SavedReconciliationSession> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(`/api/org/${orgId}/saved-reconciliation-sessions`, {
    method: "POST",
    body: request,
  });
}

/**
 * Get a single saved reconciliation session by ID
 */
export async function getSavedReconciliationSessionApi(
  sessionId: string
): Promise<SavedReconciliationSession> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(
    `/api/org/${orgId}/saved-reconciliation-sessions/${sessionId}`,
    {
      method: "GET",
    }
  );
}

/**
 * Update a saved reconciliation session
 */
export async function updateSavedReconciliationSessionApi(
  sessionId: string,
  request: UpdateSavedReconciliationSessionRequest
): Promise<SavedReconciliationSession> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(
    `/api/org/${orgId}/saved-reconciliation-sessions/${sessionId}`,
    {
      method: "PATCH",
      body: request,
    }
  );
}

/**
 * Delete a saved reconciliation session
 */
export async function deleteSavedReconciliationSessionApi(
  sessionId: string
): Promise<void> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  await zFetch(`/api/org/${orgId}/saved-reconciliation-sessions/${sessionId}`, {
    method: "DELETE",
  });
}
