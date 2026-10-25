/**
 * Create reconciliation link handler
 * 
 * Creates a link between two financial entities (headers or line items).
 */

import { createReconciliationLink } from "@zdocs/db-schema";
import type {
  CreateReconciliationLinkResponse,
  ReconciliationObjRef,
} from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

interface CreateReconciliationLinkParams {
  orgId: string; // Required but validated at route level
  sourceRef: ReconciliationObjRef;
  targetRef: ReconciliationObjRef;
  amount: number;
  currency: string;
  date: string;
  edgeType?: string;
  metadata?: Record<string, unknown>;
  type?: "manual" | "suggested";
  confidence?: number;
}

/**
 * Create a reconciliation link between two entities
 */
export async function handleCreateReconciliationLink(
  context: UiTxContext,
  params: CreateReconciliationLinkParams
): Promise<CreateReconciliationLinkResponse> {
  const { orgId } = context;
  const {
    sourceRef,
    targetRef,
    amount,
    currency,
    date,
    edgeType,
    metadata,
    type = "manual",
    confidence,
  } = params;

  // Validate required fields
  if (!sourceRef || !targetRef) {
    throw new Error("sourceRef and targetRef are required");
  }

  if (amount === undefined || amount === null) {
    throw new Error("amount is required");
  }

  if (!currency) {
    throw new Error("currency is required");
  }

  if (!date) {
    throw new Error("date is required");
  }

  // Validate entity references
  if (!sourceRef.ref.entityId || !sourceRef.ref.documentId) {
    throw new Error("sourceRef must have entityId and documentId");
  }

  if (!targetRef.ref.entityId || !targetRef.ref.documentId) {
    throw new Error("targetRef must have entityId and documentId");
  }

  // Prevent self-linking
  if (sourceRef.ref.entityId === targetRef.ref.entityId) {
    throw new Error("Cannot link entity to itself");
  }

  // Create the link
  const link = await createReconciliationLink(
    orgId,
    {
      sourceRef,
      targetRef,
      amount,
      currency,
      date,
      metadata: metadata,
      type,
      confidence: confidence ?? (type === "manual" ? 1.0 : 0.5),
    }
    // Note: userId not available in context (by design)
    // Note: edgeType not yet supported in CreateReconciliationLinkInput
  );

  // Audit log
  console.log(
    `[uiTx] Created reconciliation link: orgId=${orgId}, linkId=${link.id}, source=${sourceRef.ref.entityId}, target=${targetRef.ref.entityId}, amount=${amount} ${currency}`
  );

  return {
    ok: true,
    linkId: link.id,
  };
}
