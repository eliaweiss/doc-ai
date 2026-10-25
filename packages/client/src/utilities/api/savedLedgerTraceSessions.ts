import useOrgStore from "../../context-providers/orgStore";
import type {
  SavedLedgerTraceSession,
  LedgerTraceSessionOptions,
} from "@zdocs/types";
import { zFetch } from "../../lib/utils";

interface CreateSavedLedgerTraceSessionRequest {
  name: string;
  description?: string;
  options: LedgerTraceSessionOptions;
}

interface UpdateSavedLedgerTraceSessionRequest {
  name?: string;
  description?: string | null;
  options?: LedgerTraceSessionOptions;
}

/**
 * List all saved ledger trace sessions for the current user
 */
export async function listSavedLedgerTraceSessionsApi(): Promise<
  SavedLedgerTraceSession[]
> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${orgId}/saved-ledger-trace-sessions`,
    {
      method: "GET",
    }
  );
  return response.sessions;
}

/**
 * Create a new saved ledger trace session
 */
export async function createSavedLedgerTraceSessionApi(
  request: CreateSavedLedgerTraceSessionRequest
): Promise<SavedLedgerTraceSession> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(`/api/org/${orgId}/saved-ledger-trace-sessions`, {
    method: "POST",
    body: request,
  });
}

/**
 * Update a saved ledger trace session
 */
export async function updateSavedLedgerTraceSessionApi(
  sessionId: string,
  request: UpdateSavedLedgerTraceSessionRequest
): Promise<SavedLedgerTraceSession> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(`/api/org/${orgId}/saved-ledger-trace-sessions/${sessionId}`, {
    method: "PUT",
    body: request,
  });
}

/**
 * Delete a saved ledger trace session
 */
export async function deleteSavedLedgerTraceSessionApi(
  sessionId: string
): Promise<void> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  await zFetch(`/api/org/${orgId}/saved-ledger-trace-sessions/${sessionId}`, {
    method: "DELETE",
  });
}

/**
 * Get a single saved ledger trace session by ID
 */
export async function getSavedLedgerTraceSessionApi(
  sessionId: string
): Promise<SavedLedgerTraceSession> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(`/api/org/${orgId}/saved-ledger-trace-sessions/${sessionId}`, {
    method: "GET",
  });
}



