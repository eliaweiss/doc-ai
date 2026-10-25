/**
 * Trace reconciliation handler
 *
 * Traces money flow through reconciliation links starting from an entity.
 */

import { traceMoneyFlow, getDocumentForOrg } from "@zdocs/db-schema";
import type { TraceReconciliationResponse, EntityObj } from "@zdocs/types";
import type { TraceRequest } from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

interface TraceReconciliationParams {
  orgId: string;
  startEntityId?: string;
  endEntityId?: string;
  direction?: "both" | "incoming" | "outgoing";
  maxDepth?: number;
  limit?: number;
}

async function resolveSchemaType(
  orgId: string,
  entityId: string
): Promise<string> {
  const parts = entityId.split("_");
  const documentId = parts[0];
  const isLineItem = parts.length > 1;
  const collectionKey = isLineItem ? parts[1] : null;

  const document = await getDocumentForOrg(orgId, documentId);
  if (!document) {
    throw new Error(`Document not found for entityId: ${entityId}`);
  }
  if (!document.docType) {
    throw new Error(`Document type not set for entityId: ${entityId}`);
  }

  return isLineItem
    ? `${document.docType}_${collectionKey}`
    : `${document.docType}_header`;
}

/**
 * Trace money flow from an entity through reconciliation links
 */
export async function handleTraceReconciliation(
  context: UiTxContext,
  params: TraceReconciliationParams
): Promise<TraceReconciliationResponse> {
  const { orgId } = context;
  const {
    startEntityId,
    endEntityId,
    maxDepth = 10,
    limit = 50,
  } = params;

  if (!startEntityId && !endEntityId) {
    throw new Error("Either startEntityId or endEntityId is required");
  }

  const traceRequest: TraceRequest = {
    maxDepth,
    limit,
  };

  // doc-ai: resolveSchemaType only checks the entity exists. Passing its
  // schemaType as startSchemaTypes limited the starting links to those where
  // the entity is the source, so tracing from an invoice (usually a target)
  // or by endEntityId alone found nothing.
  if (startEntityId) {
    await resolveSchemaType(orgId, startEntityId);
    traceRequest.startEntityIds = [startEntityId];
  }

  if (endEntityId) {
    traceRequest.endEntityIds = [endEntityId];

    if (!startEntityId) {
      await resolveSchemaType(orgId, endEntityId);
      traceRequest.startEntityIds = [endEntityId];
    }
  }

  const traceResult = await traceMoneyFlow(orgId, traceRequest);

  const nodeMap = new Map<
    string,
    { ref: EntityObj; data: Record<string, unknown> }
  >();
  const edges: Array<{
    source: string;
    target: string;
    amount: number;
    currency: string;
  }> = [];

  for (const chain of traceResult.chains) {
    for (const link of chain.links) {
      if (!nodeMap.has(link.sourceRef.ref.entityId)) {
        nodeMap.set(link.sourceRef.ref.entityId, {
          ref: link.sourceRef.ref,
          data: {
            date: link.sourceRef.ref.date,
            amount: link.amount,
            currency: link.currency,
          },
        });
      }

      if (!nodeMap.has(link.targetRef.ref.entityId)) {
        nodeMap.set(link.targetRef.ref.entityId, {
          ref: link.targetRef.ref,
          data: {
            date: link.targetRef.ref.date,
            amount: link.amount,
            currency: link.currency,
          },
        });
      }

      edges.push({
        source: link.sourceRef.ref.entityId,
        target: link.targetRef.ref.entityId,
        amount: link.amount,
        currency: link.currency,
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    summary: traceResult.summary,
  };
}
