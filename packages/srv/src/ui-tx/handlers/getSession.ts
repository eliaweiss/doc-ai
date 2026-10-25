import { getOrganizationById } from "@zdocs/db-schema";
import type { UiTxSession } from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface GetSessionParams {
  // orgId comes from context, not params
}

/**
 * Get session info for the current context
 */
export async function handleGetSession(
  context: UiTxContext,
  _params: GetSessionParams = {}
): Promise<UiTxSession> {
  const { orgId, authMethod } = context;

  // Get org details for currency
  const org = await getOrganizationById(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }

  return {
    orgId,
    orgCurrency: org.baseCurrency,
    permissions: [], // TODO: Determine permissions based on user role
    mode: authMethod === "session" ? "embedded" : "http",
    runId: crypto.randomUUID(),
  };
}
