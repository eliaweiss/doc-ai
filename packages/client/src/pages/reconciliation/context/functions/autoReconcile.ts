import type {
  EntityResponse,
  FieldDefinition,
  ReconciliationPairRef,
  ToleranceReconcileMapping,
  ReconciliationPairWithTolerance,
} from "@zdocs/types";
import { reconcileWithMapping } from "./reconcileWithMapping";
import { reconcileWithExactDateMatch } from "./reconcileWithExactDateMatch";
import { detectDuplicates } from "./detectDuplicates";

/**
 * Auto Reconcile (Main Entry Point)
 *
 * Three-phase reconciliation process:
 * 1. Use fieldReconcileMapping with day drift tolerance (if configured)
 * 2. Fallback to exact date matching for unmatched records
 * 3. Detect duplicates across all suggestions for user review
 */
export function autoReconcile(
  sourceResults: EntityResponse[],
  targetResults: EntityResponse[],
  sourceSchema: FieldDefinition[],
  targetSchema: FieldDefinition[],
  reconciledPairs: ReconciliationPairRef[],
  fieldReconcileMapping: ToleranceReconcileMapping
): ReconciliationPairWithTolerance[] {
  if (sourceResults.length === 0 || targetResults.length === 0) {
    return [];
  }

  // Create lookup sets for already reconciled
  const reconciledSourceIds = new Set(
    reconciledPairs.map((p) => p.sourceRef.ref.entityId)
  );
  const reconciledTargetIds = new Set(
    reconciledPairs.map((p) => p.targetRef.ref.entityId)
  );

  // PHASE 1: Mapping-based reconciliation
  const { suggestions, matchedSourceIds, matchedTargetIds } =
    reconcileWithMapping(
      sourceResults,
      targetResults,
      sourceSchema,
      targetSchema,
      reconciledSourceIds,
      reconciledTargetIds,
      fieldReconcileMapping
    );

  // PHASE 2: Exact date match fallback
  const fallbackSuggestions = reconcileWithExactDateMatch(
    sourceResults,
    targetResults,
    sourceSchema,
    targetSchema,
    reconciledPairs,
    matchedSourceIds,
    matchedTargetIds,
    reconciledSourceIds,
    reconciledTargetIds
  );
  suggestions.push(...fallbackSuggestions);

  // PHASE 3: Duplicate detection
  detectDuplicates(suggestions);

  return suggestions;
}
