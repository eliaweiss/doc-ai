import { zdocsDb } from "../../../db";
import { searchIndexTbl } from "../../../schemas/search";
import { reconciliationLinksTbl } from "../../../schemas/reconciliation-links";
import { notExists, and, or, eq, sql, SQL } from "drizzle-orm";
import type { SearchableEntityOption } from "@zdocs/types";

/**
 * Apply reconciliation filter to exclude already-reconciled entities
 */
export function applyReconciliationFilter(
  excludeReconciled: boolean | undefined,
  reconciliationTargetEntity: SearchableEntityOption | undefined,
  orgId: string,
  conditions: SQL[]
): void {
  if (!excludeReconciled || !reconciliationTargetEntity) {
    return;
  }

  // Construct NOT EXISTS query
  // Check if current item (searchIndexTbl.entityId) exists in links as source OR target
  // AND the *partner* in the link matches the target type.
  // Use schemaType (e.g., "INVOICE_header") for comparison in ReconciliationDataRef
  const schemaType = reconciliationTargetEntity.schemaType;
  const subQuery = zdocsDb
    .select({ id: reconciliationLinksTbl.id })
    .from(reconciliationLinksTbl)
    .where(
      and(
        eq(reconciliationLinksTbl.orgId, orgId),
        sql`${reconciliationLinksTbl.deletedAt} IS NULL`,
        or(
          // Case 1: Current item is Source in the link, Target matches the target entity type
          and(
            sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'entityId' = ${searchIndexTbl.entityId}`,
            sql`${reconciliationLinksTbl.targetRef}->'ref'->>'schemaType' = ${schemaType}`
          ),
          // Case 2: Current item is Target in the link, Source matches the target entity type
          and(
            sql`${reconciliationLinksTbl.targetRef}->'ref'->>'entityId' = ${searchIndexTbl.entityId}`,
            sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'schemaType' = ${schemaType}`
          )
        )
      )
    );

  conditions.push(notExists(subQuery));
}
