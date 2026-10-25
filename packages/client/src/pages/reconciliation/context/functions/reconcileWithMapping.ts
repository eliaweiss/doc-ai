import { getDayDrift } from "@zdocs/util";
import {
  ReconciliationObjRef,
  type EntityResponse,
  type FieldDefinition,
  type ToleranceReconcileMapping,
  type ReconciliationPairWithTolerance,
} from "@zdocs/types";

/**
 * Check if actual drift is within allowed range based on maxDayDrift sign
 * - maxDayDrift >= 0: target should be same or AFTER source (drift in [0, maxDayDrift])
 * - maxDayDrift < 0: target should be same or BEFORE source (drift in [maxDayDrift, 0])
 */
function isDriftInRange(actualDrift: number, maxDayDrift: number): boolean {
  if (maxDayDrift >= 0) {
    // Positive: target should be same or AFTER source
    return actualDrift >= 0 && actualDrift <= maxDayDrift;
  } else {
    // Negative: target should be same or BEFORE source
    return actualDrift <= 0 && actualDrift >= maxDayDrift;
  }
}

/**
 * PHASE 1: Reconcile using fieldReconcileMapping with day drift tolerance
 * Uses configured field names, signs, and day drift to find best matches
 * Returns suggestions and sets of matched IDs
 */
export function reconcileWithMapping(
  sourceResults: EntityResponse[],
  targetResults: EntityResponse[],
  sourceSchema: FieldDefinition[],
  targetSchema: FieldDefinition[],
  reconciledSourceIds: Set<string>,
  reconciledTargetIds: Set<string>,
  fieldReconcileMapping: ToleranceReconcileMapping
): {
  suggestions: ReconciliationPairWithTolerance[];
  matchedSourceIds: Set<string>;
  matchedTargetIds: Set<string>;
} {
  const suggestions: ReconciliationPairWithTolerance[] = [];
  const matchedSourceIds = new Set<string>();
  const matchedTargetIds = new Set<string>();

  // Outer loop: iterate through each configured field mapping
  for (const sourceFieldName in fieldReconcileMapping) {
    const targetMappings = fieldReconcileMapping[sourceFieldName];

    for (const targetFieldName in targetMappings) {
      const { sign, dayDrift: maxDayDrift, amountDrift: maxAmountDrift } = targetMappings[targetFieldName];

      // For each source, find the BEST target (minimum drift)
      for (const source of sourceResults) {
        // Skip if already matched or reconciled
        if (matchedSourceIds.has(source.ref.entityId)) continue;
        if (reconciledSourceIds.has(source.ref.entityId)) continue;

        const sourceDate = source.ref.date;
        if (!sourceDate) continue;

        // Get source amount and currency for this field
        const sourceAmount = source.data[sourceFieldName] as number;
        if (typeof sourceAmount !== "number" || sourceAmount === 0) continue;

        const sourceFieldSchema = sourceSchema.find(
          (f) => f.name === sourceFieldName
        );

        let sourceCurrency = source.preview.currency;
        if (
          sourceFieldSchema?.currencyField &&
          source.data[sourceFieldSchema.currencyField]
        ) {
          sourceCurrency = source.data[
            sourceFieldSchema.currencyField
          ] as string;
        }
        if (!sourceCurrency) continue;

        // Find best target (minimum actual drift)
        let bestTarget: EntityResponse | null = null;
        let bestAbsDrift = Infinity;
        let bestActualDrift = 0;
        let bestTargetAmount: number | null = null;

        for (const target of targetResults) {
          // Skip if already matched or reconciled
          if (matchedTargetIds.has(target.ref.entityId)) continue;
          if (reconciledTargetIds.has(target.ref.entityId)) continue;

          const targetDate = target.ref.date;
          if (!targetDate) continue;

          // Check day drift using existing utility
          const actualDrift = getDayDrift(sourceDate, targetDate);
          if (!isDriftInRange(actualDrift, maxDayDrift)) continue;

          // Get target amount and currency
          const targetAmount = target.data[targetFieldName] as number;
          if (typeof targetAmount !== "number" || targetAmount === 0) continue;

          const targetFieldSchema = targetSchema.find(
            (f) => f.name === targetFieldName
          );

          let targetCurrency = target.preview.currency;
          if (
            targetFieldSchema?.currencyField &&
            target.data[targetFieldSchema.currencyField]
          ) {
            targetCurrency = target.data[
              targetFieldSchema.currencyField
            ] as string;
          }
          if (!targetCurrency) continue;

          // Check currency and amount match
          if (sourceCurrency !== targetCurrency) continue;
          const amountDiff = Math.abs(
            Math.abs(sourceAmount) - Math.abs(targetAmount)
          );
          const tolerance = maxAmountDrift ?? 0.1;
          if (amountDiff > tolerance) continue;

          // Check sign compatibility
          // sign "-" means source and target have opposing signs
          // sign "+" means source and target have same sign
          const signsNaturallyMatch = sourceAmount * targetAmount > 0;
          const signCompatible =
            (sign === "+" && signsNaturallyMatch) ||
            (sign === "-" && !signsNaturallyMatch);
          if (!signCompatible) continue;

          // Track best match (minimum absolute drift)
          const absDrift = Math.abs(actualDrift);
          if (absDrift < bestAbsDrift) {
            bestAbsDrift = absDrift;
            bestActualDrift = actualDrift;
            bestTarget = target;
            bestTargetAmount = targetAmount;
          }
        }

        // If found a match, add to suggestions
        if (bestTarget && bestTargetAmount) {
          const amount =
            sign === "-" ? -Math.abs(sourceAmount) : Math.abs(sourceAmount);
          const bestAmountDiff = Math.abs(
            Math.abs(sourceAmount) - Math.abs(bestTargetAmount)
          );

          const sourceRef: ReconciliationObjRef = {
            ref: source.ref,
            field: {
              name: sourceFieldName,
              value: sourceAmount,
              description: source.preview.description,
            },
          };
          const targetRef: ReconciliationObjRef = {
            ref: bestTarget.ref,
            field: {
              name: targetFieldName,
              value: bestTargetAmount,
              description: bestTarget.preview.description,
            },
          };
          suggestions.push({
            sourceRef,
            targetRef,
            amount,
            currency: sourceCurrency,
            date: sourceDate,
            sign,
            signChoiceMade: true,
            dayDrift: bestActualDrift,
            amountDiff: bestAmountDiff,
            matchMethod: "rule",
            matchRule: targetMappings[targetFieldName],
            needManualCheck: [],
          });

          matchedSourceIds.add(source.ref.entityId);
          matchedTargetIds.add(bestTarget.ref.entityId);
        }
      }
    }
  }

  return { suggestions, matchedSourceIds, matchedTargetIds };
}
