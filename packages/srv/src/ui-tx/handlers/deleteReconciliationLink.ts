/**
 * Delete reconciliation link handler
 * 
 * Soft deletes a reconciliation link by ID.
 */

import { deleteReconciliationLink } from "@zdocs/db-schema";
import type { UiTxContext } from "../handleUiTxRequest";

interface DeleteReconciliationLinkParams {
  orgId: string; // Required but validated at route level
  linkId: string;
}

/**
 * Delete a reconciliation link (soft delete)
 */
export async function handleDeleteReconciliationLink(
  context: UiTxContext,
  params: DeleteReconciliationLinkParams
): Promise<{ ok: true }> {
  const { orgId } = context;
  const { linkId } = params;

  if (!linkId) {
    throw new Error("linkId is required");
  }

  // Delete the link (soft delete)
  await deleteReconciliationLink(orgId, linkId);

  // Audit log
  console.log(
    `[uiTx] Deleted reconciliation link: orgId=${orgId}, linkId=${linkId}`
  );

  return { ok: true };
}
