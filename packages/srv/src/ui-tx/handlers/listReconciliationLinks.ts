/**
 * List reconciliation links handler
 * 
 * Lists reconciliation links with optional filtering.
 */

import { getReconciliationLinksForOrg, getLinksForEntity } from "@zdocs/db-schema";
import type {
  ListReconciliationLinksResponse,
  ReconciliationLinkFilters,
} from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

interface ListReconciliationLinksParams {
  orgId: string; // Required but validated at route level
  entityId?: string; // Filter by entity ID (bidirectional)
  schemaType?: string; // Filter by schema type
  limit?: number; // Limit results
}

/**
 * List reconciliation links with optional filtering
 */
export async function handleListReconciliationLinks(
  context: UiTxContext,
  params: ListReconciliationLinksParams
): Promise<ListReconciliationLinksResponse> {
  const { orgId } = context;
  const { entityId, schemaType, limit } = params;

  let links;

  if (entityId) {
    // Get links for a specific entity (bidirectional)
    links = await getLinksForEntity(orgId, entityId);
  } else {
    // Get all links with filters
    const filters: ReconciliationLinkFilters = {};
    if (schemaType) {
      // Note: schemaType filter would need to be added to ReconciliationLinkFilters
      // For now, we'll get all links and filter in memory if needed
    }

    const allLinks = await getReconciliationLinksForOrg(orgId, filters);
    links = allLinks.map((link) => ({
      id: link.id,
      orgId: link.orgId,
      sourceRef: link.sourceRef,
      targetRef: link.targetRef,
      date: link.date,
      amount: link.amount,
      currency: link.currency,
      type: link.type,
      edgeType: link.edgeType,
      confidence: link.confidence,
      metadata: link.metadata,
      createdBy: link.createdBy,
      deletedAt: link.deletedAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }));
  }

  // Apply schemaType filter if specified
  if (schemaType) {
    links = links.filter(
      (link) =>
        link.sourceRef.ref.schemaType === schemaType ||
        link.targetRef.ref.schemaType === schemaType
    );
  }

  // Apply limit if specified
  if (limit && limit > 0) {
    links = links.slice(0, limit);
  }

  return {
    links,
  };
}
