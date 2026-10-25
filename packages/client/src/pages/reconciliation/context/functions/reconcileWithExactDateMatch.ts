import type {
  EntityResponse,
  FieldDefinition,
  ReconciliationPairRef,
  ReconciliationPairWithTolerance,
} from "@zdocs/types";
import { exactDateAutoReconcile } from "./exactDateAutoReconcile";

/**
 * PHASE 2: Reconcile unmatched records using exact date match
 * Fallback for records that didn't match via mapping
 */
export function reconcileWithExactDateMatch(
  sourceResults: EntityResponse[],
  targetResults: EntityResponse[],
  sourceSchema: FieldDefinition[],
  targetSchema: FieldDefinition[],
  reconciledPairs: ReconciliationPairRef[],
  matchedSourceIds: Set<string>,
  matchedTargetIds: Set<string>,
  reconciledSourceIds: Set<string>,
  reconciledTargetIds: Set<string>
): ReconciliationPairWithTolerance[] {
  // Filter to unmatched records only
  const unmatchedSources = sourceResults.filter(
    (s) =>
      !matchedSourceIds.has(s.ref.entityId) &&
      !reconciledSourceIds.has(s.ref.entityId)
  );
  const unmatchedTargets = targetResults.filter(
    (t) =>
      !matchedTargetIds.has(t.ref.entityId) &&
      !reconciledTargetIds.has(t.ref.entityId)
  );

  if (unmatchedSources.length === 0 || unmatchedTargets.length === 0) {
    return [];
  }

  // Use exact date matching logic
  return exactDateAutoReconcile(
    unmatchedSources,
    unmatchedTargets,
    sourceSchema,
    targetSchema,
    reconciledPairs,
    {} // Empty mapping - uses exact date match only
  );
}
