import type {
  EntityResponse,
  FieldDefinition,
  ReconciliationPairRef,
  ToleranceReconcileMapping,
} from "@zdocs/types";
import { findCurrencyFieldMatch } from "./findCurrencyFieldMatch";
import type { ReconciliationPairWithTolerance } from "@zdocs/types";

/**
 * Auto Reconcile
 * Search for pairs of source and target results that match on date,
 * and has a currency field that is the same for both source and target (amount and currency must be the same)
 * Returns suggested pairs that the user can review and create links for
 */
export function exactDateAutoReconcile(
  sourceResults: EntityResponse[],
  targetResults: EntityResponse[],
  sourceSchema: FieldDefinition[],
  targetSchema: FieldDefinition[],
  reconciledPairs: ReconciliationPairRef[],
  fieldReconcileMapping: ToleranceReconcileMapping
): ReconciliationPairWithTolerance[] {
  // console.log("[autoReconcile] Starting auto-reconcile", {
  //   sourceCount: sourceResults.length,
  //   targetCount: targetResults.length,
  //   reconciledPairsCount: reconciledPairs.length,
  // });

  if (sourceResults.length === 0 || targetResults.length === 0) {
    // console.log("[autoReconcile] Early return: no source or target results");
    return [];
  }

  const suggestions: ReconciliationPairWithTolerance[] = [];

  // Iterate through source results
  for (const source of sourceResults) {
    // console.log("source", source);
    // Skip if already reconciled
    const isReconciled = reconciledPairs.some(
      (p) => p.sourceRef.ref.entityId === source.ref.entityId
    );
    if (isReconciled) {
      // console.log(
      //   `[autoReconcile] Skipping source ${source.ref.entityId} - already reconciled`
      // );
      continue;
    }

    // console.log(
    //   `[autoReconcile] Processing source ${source.ref.entityId} with date ${source.ref.date}`
    // );

    // Find matching target records
    for (const target of targetResults) {
      // Skip if already reconciled
      const isTargetReconciled = reconciledPairs.some(
        (p) => p.targetRef.ref.entityId === target.ref.entityId
      );
      if (isTargetReconciled) {
        // console.log(
        //   `[autoReconcile] Skipping target ${target.ref.entityId} - already reconciled`
        // );
        continue;
      }

      // Extract date from metadata

      const sourceDate = source.ref.date;
      // Extract date from metadata
      const targetDate = target.ref.date;
      // Check if dates match
      if (sourceDate !== targetDate) {
        // console.log(
        //   `[autoReconcile] Dates don't match: source=${sourceDate}, target=${targetDate}`
        // );
        continue;
      }

      // console.log(
      //   `[autoReconcile] Dates match (${sourceDate}), checking currency fields: source=${source.ref.entityId}, target=${target}`
      // );

      // Check if currency fields match
      const match = findCurrencyFieldMatch(
        source,
        target,
        sourceSchema,
        targetSchema,
        fieldReconcileMapping
      );
      if (match) {
        // console.log(
        //   `[autoReconcile] ✓ Match found: source=${source.entityId}, target=${target.entityId}`
        // );

        suggestions.push(match);
      }
    }
  }

  // Note: Duplicate detection is handled by autoReconcile (Phase 3)
  // which calls this function as a fallback

  return suggestions;
}
