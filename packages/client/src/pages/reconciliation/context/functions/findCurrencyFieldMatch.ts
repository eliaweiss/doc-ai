import {
  type EntityResponse,
  type FieldDefinition,
  type ReconciliationPairWithTolerance,
  type SignSymbol,
  type ToleranceReconcileMapping,
  ReconciliationObjRef,
} from "@zdocs/types";

/**
 * Find matching currency fields between source and target records
 * Checks if there are any currency fields with matching currency codes and amounts
 * @returns true if a match is found, false otherwise
 */
export function findCurrencyFieldMatch(
  source: EntityResponse,
  target: EntityResponse,
  sourceSchema: FieldDefinition[],
  targetSchema: FieldDefinition[],
  fieldReconcileMapping: ToleranceReconcileMapping
): ReconciliationPairWithTolerance | null {
  let possibleMatch: ReconciliationPairWithTolerance | null = null;

  // Find currency fields in both source and target schemas
  // Compare all currency field pairs to find a match
  for (const sourceFieldName in source.data) {
    const sourceFieldSchema = sourceSchema.find(
      (f) => f.name === sourceFieldName
    );
    if (!sourceFieldSchema || sourceFieldSchema.type !== "currency") {
      continue;
    }

    // console.log(
    //   `[findCurrencyFieldMatch] Found source currency field: ${sourceFieldName}`
    // );

    const sourceAmount = source.data[sourceFieldName] as number;
    if (
      sourceAmount === null ||
      sourceAmount === undefined ||
      typeof sourceAmount !== "number" ||
      sourceAmount === 0
    ) {
      // console.log(
      //   `[findCurrencyFieldMatch] Skipping ${sourceFieldName} - invalid amount:`,
      //   sourceAmount
      // );
      continue;
    }

    // Get currency code from currencyField or fallback to metadata
    let sourceCurrency: string | null = null;
    if (sourceFieldSchema.currencyField) {
      sourceCurrency =
        (source.data[sourceFieldSchema.currencyField] as string) || null;
      // console.log(
      //   `[findCurrencyFieldMatch] Source currency from field ${sourceFieldSchema.currencyField}:`,
      //   sourceCurrency
      // );
    }
    if (!sourceCurrency) {
      sourceCurrency = source.preview.currency || null;
      // console.log(
      //   `[findCurrencyFieldMatch] Source currency from metadata:`,
      //   sourceCurrency
      // );
    }
    if (!sourceCurrency) {
      // console.log(
      //   `[findCurrencyFieldMatch] Skipping ${sourceFieldName} - no currency code`
      // );
      continue;
    }

    // console.log(
    //   `[findCurrencyFieldMatch] Source: field=${sourceFieldName}, amount=${sourceAmount}, currency=${sourceCurrency}`
    // );

    // Check all target currency fields
    for (const targetFieldName in target.data) {
      const targetFieldSchema = targetSchema.find(
        (f) => f.name === targetFieldName
      );
      if (!targetFieldSchema || targetFieldSchema.type !== "currency") {
        continue;
      }

      // console.log(
      //   `[findCurrencyFieldMatch] Found target currency field: ${targetFieldName}`
      // );

      const targetAmount = target.data[targetFieldName] as number;
      if (
        targetAmount === null ||
        targetAmount === undefined ||
        typeof targetAmount !== "number" ||
        targetAmount === 0
      ) {
        // console.log(
        //   `[findCurrencyFieldMatch] Skipping ${targetFieldName} - invalid amount:`,
        //   targetAmount
        // );
        continue;
      }

      // Get currency code from currencyField or fallback to metadata
      let targetCurrency: string | null = null;
      if (targetFieldSchema.currencyField) {
        targetCurrency =
          (target.data[targetFieldSchema.currencyField] as string) || null;
        // console.log(
        //   `[findCurrencyFieldMatch] Target currency from field ${targetFieldSchema.currencyField}:`,
        //   targetCurrency
        // );
      }
      if (!targetCurrency) {
        targetCurrency = target.preview.currency || null;
        // console.log(
        //   `[findCurrencyFieldMatch] Target currency from metadata:`,
        //   targetCurrency
        // );
      }
      if (!targetCurrency) {
        // console.log(
        //   `[findCurrencyFieldMatch] Skipping ${targetFieldName} - no currency code`
        // );
        continue;
      }

      // console.log(
      //   `[findCurrencyFieldMatch] Target: field=${targetFieldName}, amount=${targetAmount}, currency=${targetCurrency}`
      // );

      // Check for match: same currency code and same amount
      const amountDiff = Math.abs(
        Math.abs(sourceAmount) - Math.abs(targetAmount)
      );
      const currenciesMatch = sourceCurrency === targetCurrency;
      let amountDrift = 0.1;
      if (fieldReconcileMapping) {
        const fieldReconcilePair =
          fieldReconcileMapping[sourceFieldName]?.[targetFieldName];
        amountDrift = fieldReconcilePair?.amountDrift ?? 0.1;
      }
      const amountsMatch = amountDiff < amountDrift;
      const signMatch = sourceAmount * targetAmount > 0;
      let sign: SignSymbol | undefined = signMatch
        ? sourceAmount > 0
          ? "+"
          : "-"
        : undefined;
      if (!sign && fieldReconcileMapping) {
        const fieldReconcilePair =
          fieldReconcileMapping[sourceFieldName]?.[targetFieldName];
        sign = fieldReconcilePair?.sign;
        // console.log(
        //   "sign",
        //   sign,
        //   "sourceFieldName",
        //   sourceFieldName,
        //   "targetFieldName",
        //   targetFieldName
        // );
      }
      let amount = sourceAmount;
      if (sign) {
        amount =
          sign === "+" ? Math.abs(sourceAmount) : -Math.abs(sourceAmount);
      }
      let signChoiceMade = sign ? true : false;

      // console.log(
      //   `[findCurrencyFieldMatch] Comparing: currenciesMatch=${currenciesMatch}, amountsMatch=${amountsMatch} (diff=${amountDiff})`
      // );

      const sourceRef: ReconciliationObjRef = {
        ref: source.ref,
        field: {
          name: sourceFieldName,
          value: sourceAmount,
          description: source.preview.description,
        },
      };
      const targetRef: ReconciliationObjRef = {
        ref: target.ref,
        field: {
          name: targetFieldName,
          value: targetAmount,
          description: target.preview.description,
        },
      };

      if (currenciesMatch && amountsMatch) {
        const match = {
          source: source,
          target: target,
          sourceRef,
          targetRef,
          amount,
          currency: sourceCurrency,
          date: source.ref.date,
          sign,
          signChoiceMade,
          dayDrift: 0,
          amountDiff,
          matchMethod: "exactDate" as const,
          needManualCheck: [],
        };
        if (signChoiceMade) {
          // console.log(
          //   `[findCurrencyFieldMatch] ✓ MATCH FOUND: ${sourceFieldName} (${sourceAmount} ${sourceCurrency}) === ${targetFieldName} (${targetAmount} ${targetCurrency})`
          // );
          return match; // Found a match
        } else {
          possibleMatch = match;
        }
      } else {
        // console.log(
        //   `[findCurrencyFieldMatch] ✗ No match: currenciesMatch=${currenciesMatch}, amountsMatch=${amountsMatch}`
        // );
      }
    }
  }

  // console.log(
  //   `[findCurrencyFieldMatch] No match found: source=${source.entityId}, target=${target.entityId}`
  // );
  return possibleMatch; // No match found
}
