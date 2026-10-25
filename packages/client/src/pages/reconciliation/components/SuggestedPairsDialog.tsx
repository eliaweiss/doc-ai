"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import { ScrollArea } from "@zdocs/client-component";
import { cn, formatCurrency, formatDate } from "@zdocs/util";
import type { ReconciliationPairWithTolerance, SignSymbol } from "@zdocs/types";
import { Loader2, ArrowRight, Plus, Minus } from "lucide-react";
import { useReconciliation } from "../context/ReconciliationContext";
import { AmountCurrencyEditor } from "./AmountCurrencyEditor";
import { MatchCriteriaChips } from "./MatchCriteriaChips";
import { toast } from "sonner";

interface SuggestedPairsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suggestedPairs: ReconciliationPairWithTolerance[];
  onCreateLinks: (pairs: ReconciliationPairWithTolerance[]) => Promise<void>;
}

function hasOppositeSigns(pair: ReconciliationPairWithTolerance): boolean {
  const sourceVal = pair.sourceRef.field.value;
  const targetVal = pair.targetRef.field.value;

  if (sourceVal == null || targetVal == null) {
    return false;
  }

  return (
    (sourceVal >= 0 && targetVal < 0) || (sourceVal < 0 && targetVal >= 0)
  );
}

function getDefaultSign(pair: ReconciliationPairWithTolerance): SignSymbol {
  if (pair.sign) {
    return pair.sign;
  }

  return pair.amount >= 0 ? "+" : "-";
}

function applyDefaultSign(
  pair: ReconciliationPairWithTolerance
): ReconciliationPairWithTolerance {
  if (!hasOppositeSigns(pair) || pair.signChoiceMade) {
    return pair;
  }

  const sign = getDefaultSign(pair);

  return {
    ...pair,
    amount: sign === "+" ? Math.abs(pair.amount) : -Math.abs(pair.amount),
    sign,
    signChoiceMade: true,
  };
}

export function SuggestedPairsDialog({
  isOpen,
  onClose,
  onCreateLinks,
}: SuggestedPairsDialogProps) {
  const t = useTranslations("reconciliation.suggestedPairs");
  const {
    suggestedPairs: originalSuggestedPairs,
    sourceEntityName,
    targetEntityName,
    sourceResults,
    targetResults,
  } = useReconciliation();

  // Track edited values per pair index
  const [editedValues, setEditedValues] = useState<
    Map<number, ReconciliationPairWithTolerance>
  >(new Map());

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const addToSelectedIndices = (index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  };

  const [isCreating, setIsCreating] = useState(false);

  // Initialize editedValues from originalSuggestedPairs when dialog opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const pairsWithDefaultSigns = originalSuggestedPairs.map(applyDefaultSign);
    const initialEditedValues = new Map(
      pairsWithDefaultSigns.map((pair, index) => [index, pair])
    );
    setEditedValues(initialEditedValues);

    setSelectedIndices(
      new Set(Array.from({ length: pairsWithDefaultSigns.length }, (_, i) => i))
    );
  }, [isOpen, originalSuggestedPairs]);

  // Derive available currencies from results
  const availableCurrencies = useMemo(() => {
    const currencySet = new Set<string>();

    [...sourceResults, ...targetResults].forEach((item) => {
      if (item.preview?.currency) {
        currencySet.add(item.preview.currency);
      }
      if (item.data) {
        Object.entries(item.data).forEach(([key, value]) => {
          if (
            key.toLowerCase().includes("currency") &&
            typeof value === "string" &&
            value.length === 3
          ) {
            currencySet.add(value);
          }
        });
      }
    });

    const currencies = Array.from(currencySet).sort();
    if (currencies.length === 0) return ["USD"];
    return currencies;
  }, [sourceResults, targetResults]);

  const [
    suggestedPairsWithSignChoiceMade,
    setSuggestedPairsWithSignChoiceMade,
  ] = useState<{
    sourceFieldName: string;
    targetFieldName: string;
    sign: SignSymbol;
  } | null>(null);

  const handleUpdateEditedValue = (
    index: number,
    updates: Partial<{
      amount: number | null;
      currency: string;
      signChoiceMade: boolean;
      sign: SignSymbol;
    }>
  ) => {
    setEditedValues((prev) => {
      const next = new Map(prev);
      const current = next.get(index);
      if (!current) {
        return prev;
      }
      const updatedPair = {
        ...current,
        ...updates,
      } as ReconciliationPairWithTolerance;
      if (typeof updates.amount === "number") {
        updatedPair.sign = updates.sign ?? (updates.amount >= 0 ? "+" : "-");
      }
      next.set(index, updatedPair);
      return next;
    });
    addToSelectedIndices(index);
    if (updates.amount === undefined && updates.sign === undefined) {
      return;
    }
    const pair = editedValues.get(index)!;
    if (!pair.sourceRef.field.name || !pair.targetRef.field.name) {
      throw new Error("Source or target field name is missing");
    }
    const sourceFieldName = pair.sourceRef.field.name;
    const targetFieldName = pair.targetRef.field.name;
    const sign =
      updates.sign ??
      (typeof updates.amount === "number" && updates.amount >= 0 ? "+" : "-");
    setSuggestedPairsWithSignChoiceMade({
      sourceFieldName,
      targetFieldName,
      sign,
    });
  };

  const handleTogglePair = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const handleToggleAll = () => {
    const pairCount = editedValues.size;
    if (selectedIndices.size === pairCount) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(
        new Set(Array.from({ length: pairCount }, (_, i) => i))
      );
    }
  };

  const handleCreateLinks = async () => {
    const selectedPairsWithEdits = Array.from(selectedIndices).map((index) => {
      const pair = editedValues.get(index)!;
      const edited = editedValues.get(index);

      if (hasOppositeSigns(pair) && !edited?.signChoiceMade) {
        return null; // Should not happen if button is disabled correctly
      }

      if (edited) {
        return {
          ...pair,
          amount: edited.amount,
          currency: edited.currency,
        };
      }
      return pair;
    });

    const pairsToCreate = selectedPairsWithEdits.filter(
      (p): p is ReconciliationPairWithTolerance => p !== null
    );
    if (pairsToCreate.length === 0) return;

    setIsCreating(true);
    try {
      await onCreateLinks(pairsToCreate);
      onClose();
    } catch (error) {
      console.error("Error creating links:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const allSelected = selectedIndices.size === editedValues.size;
  const someSelected = selectedIndices.size > 0 && !allSelected;

  const canCreateLinks = useMemo(() => {
    if (selectedIndices.size === 0) return false;

    // Check if all selected pairs have valid sign choices if needed
    for (const index of selectedIndices) {
      const pair = editedValues.get(index);
      if (!pair) continue;

      if (hasOppositeSigns(pair) && !pair.signChoiceMade) {
        return false;
      }
    }

    return true;
  }, [selectedIndices, editedValues]);

  function handleSetAllSignChoice(): void {
    if (!suggestedPairsWithSignChoiceMade) return;

    editedValues.forEach((pair, index) => {
      if (
        pair.sourceRef.field.name ===
        suggestedPairsWithSignChoiceMade.sourceFieldName &&
        pair.targetRef.field.name ===
        suggestedPairsWithSignChoiceMade.targetFieldName
      ) {
        const sign = suggestedPairsWithSignChoiceMade.sign;
        let amount = pair.amount;
        if (sign === "+") {
          amount = Math.abs(amount);
        } else {
          amount = -Math.abs(amount);
        }
        handleUpdateEditedValue(index, {
          signChoiceMade: true,
          amount,
          sign,
        });
        addToSelectedIndices(index);
      }
    });

    setSuggestedPairsWithSignChoiceMade(null);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-[90vw]  flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-start gap-2 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={handleToggleAll}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              {allSelected ? t("deselectAll") : t("selectAll")}
            </label>
          </div>
          <span
            className={cn(
              selectedIndices.size === editedValues.size
                ? "text-sm text-muted-foreground"
                : "font-bold"
            )}
          >
            (
            {t("selectedCount", {
              count: selectedIndices.size,
              total: editedValues.size,
            })}
            )
          </span>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="py-2 space-y-1">
            <div className="flex items-center justify-between">
              <div>{sourceEntityName}</div>
              <div>{targetEntityName}</div>
            </div>
            {Array.from(editedValues.values()).map((pair, index) => {
              const hasOppositeSign = hasOppositeSigns(pair);
              const canCreate = !hasOppositeSign || pair.signChoiceMade;
              const sourceDate = pair.sourceRef.ref.date;
              const targetDate = pair.targetRef.ref.date;
              const sourceAmount = pair.sourceRef.field.value;
              const targetAmount = pair.targetRef.field.value;

              return (
                <div
                  key={`${pair.sourceRef.ref.entityId}-${pair.targetRef.ref.entityId}`}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border transition-colors p-3",
                    selectedIndices.has(index)
                      ? "bg-accent/50 border-primary/30"
                      : "bg-background border-border",
                    !canCreate && selectedIndices.has(index)
                      ? "border-destructive/50"
                      : ""
                  )}
                >
                  <div className={`flex items-start gap-4  `}>
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIndices.has(index)}
                        onCheckedChange={() => handleTogglePair(index)}
                      />
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                      {/* Source */}
                      <div className="min-w-0 ">
                        <p
                          className="text-sm font-medium truncate"
                          title={pair.sourceRef.field.description}
                        >
                          {pair.sourceRef.field.description}
                        </p>
                        {(sourceDate || sourceAmount != null) && (
                          <p
                            className="text-xs text-muted-foreground"
                            data-testid={`pair-${index}-source-meta`}
                          >
                            {sourceDate && `${t("date")}: ${formatDate(sourceDate)}`}
                            {sourceDate && sourceAmount != null && " · "}
                            {sourceAmount != null && (
                              <>
                                {t("amount")}:{" "}
                                <span className="font-bold">
                                  {formatCurrency(sourceAmount, pair.currency)}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Arrow/Amount */}
                      <div className="flex flex-col items-center gap-1 px-2">
                        <AmountCurrencyEditor
                          amount={pair.amount}
                          currency={pair.currency}
                          availableCurrencies={availableCurrencies}
                          onAmountChange={(val) =>
                            handleUpdateEditedValue(index, { amount: val })
                          }
                          onCurrencyChange={(val) =>
                            handleUpdateEditedValue(index, { currency: val })
                          }
                          compact
                          hasOppositeSign={hasOppositeSign}
                          signChoiceMade={pair.signChoiceMade}
                          onSetPositive={() => {
                            if (!pair.amount) {
                              toast.error(t("amountRequired"));
                              return;
                            }
                            const val = Math.abs(pair.amount);
                            handleUpdateEditedValue(index, {
                              amount: val,
                              signChoiceMade: true,
                              sign: "+",
                            });
                          }}
                          onSetNegative={() => {
                            if (!pair.amount) {
                              toast.error(t("amountRequired"));
                              return;
                            }
                            const val = -Math.abs(pair.amount);
                            handleUpdateEditedValue(index, {
                              amount: val,
                              signChoiceMade: true,
                              sign: "-",
                            });
                          }}
                          testIdPrefix={`pair-${index}-`}
                        />
                      </div>

                      {/* Target */}
                      <div className="min-w-0 text-right">
                        <p
                          className="text-sm font-medium truncate"
                          title={pair.targetRef.field.description}
                        >
                          {pair.targetRef.field.description}
                        </p>
                        {(targetDate || targetAmount != null) && (
                          <p
                            className="text-xs text-muted-foreground"
                            data-testid={`pair-${index}-target-meta`}
                          >
                            {targetDate && `${t("date")}: ${formatDate(targetDate)}`}
                            {targetDate && targetAmount != null && " · "}
                            {targetAmount != null && (
                              <>
                                {t("amount")}:{" "}
                                <span className="font-bold">
                                  {formatCurrency(targetAmount, pair.currency)}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {pair.needManualCheck.length > 0 && (
                    <div className="flex items-center gap-2 justify-start flex-wrap">
                      {pair.needManualCheck.map((check) => (
                        <div
                          className=" bg-orange-200 text-xs rounded-md p-1"
                          key={check.reason}
                        >
                          {check.reason}
                        </div>
                      ))}
                    </div>
                  )}

                  <MatchCriteriaChips pair={pair} index={index} />
                </div>
              );
            })}
          </div>
        </ScrollArea>
        {suggestedPairsWithSignChoiceMade && (
          <div className="flex gap-2 bg-orange-100/50 p-2 rounded-md items-center justify-center">
            {t("setAll")}
            <p className="font-bold capitalize">
              {suggestedPairsWithSignChoiceMade.sourceFieldName}
            </p>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <p className="font-bold capitalize">
              {suggestedPairsWithSignChoiceMade.targetFieldName}
            </p>
            {t("to")}
            <Button
              variant="outline"
              size="icon"
              className="w-6 h-6 rounded border transition-colors font-bold"
              onClick={() => handleSetAllSignChoice()}
            >
              {suggestedPairsWithSignChoiceMade.sign === "+" ? (
                <Plus className={cn("w-3 h-3")} />
              ) : (
                <Minus className={cn("w-3 h-3")} />
              )}
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreateLinks}
            disabled={!canCreateLinks || isCreating}
            className="min-w-[120px]"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("creatingLinks")}
              </>
            ) : (
              t("createLinks")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
