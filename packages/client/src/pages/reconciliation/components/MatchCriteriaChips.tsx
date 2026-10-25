"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zdocs/client-component";
import { formatCurrency } from "@zdocs/util";
import type {
  ReconciliationPairWithTolerance,
  ToleranceReconcilePair,
} from "@zdocs/types";
import { useReconciliation } from "../context/ReconciliationContext";

interface MatchCriteriaChipsProps {
  pair: ReconciliationPairWithTolerance;
  index: number;
}

type CriterionKind = "fieldMapping" | "amount" | "date";

interface Criterion {
  kind: CriterionKind;
  label: string;
  detail: string;
}

export function MatchCriteriaChips({
  pair,
  index,
}: MatchCriteriaChipsProps) {
  const t = useTranslations("reconciliation.suggestedPairs");
  const {
    fieldReconcileMapping,
    fieldMappingOverrides,
    updateFieldMappingOverride,
  } = useReconciliation();

  const sourceFieldName = pair.sourceRef.field.name ?? null;
  const targetFieldName = pair.targetRef.field.name ?? null;

  const rule: ToleranceReconcilePair | undefined =
    (sourceFieldName && targetFieldName
      ? fieldReconcileMapping[sourceFieldName]?.[targetFieldName]
      : undefined) ?? pair.matchRule;

  const overrideRule: ToleranceReconcilePair | undefined =
    sourceFieldName && targetFieldName
      ? fieldMappingOverrides[sourceFieldName]?.[targetFieldName]
      : undefined;

  const matchMethod = pair.matchMethod ?? (rule ? "rule" : "exactDate");
  const sourceAmount = pair.sourceRef.field.value;
  const targetAmount = pair.targetRef.field.value;
  const hasOppositeSigns =
    sourceAmount != null &&
    targetAmount != null &&
    ((sourceAmount >= 0 && targetAmount < 0) ||
      (sourceAmount < 0 && targetAmount >= 0));

  const amountDiff =
    typeof pair.amountDiff === "number"
      ? pair.amountDiff
      : Math.abs(
          Math.abs(pair.sourceRef.field.value ?? 0) -
            Math.abs(pair.targetRef.field.value ?? 0)
        );

  const dayDrift =
    typeof pair.dayDrift === "number"
      ? pair.dayDrift
      : pair.sourceRef.ref.date === pair.targetRef.ref.date
        ? 0
        : null;

  // Currency is intentionally hidden: it is already implied by the pair amount.
  const criteria: Criterion[] = [
    {
      kind: "fieldMapping",
      label: t("criteria.fieldMapping", {
        sourceField: sourceFieldName ?? "-",
        targetField: targetFieldName ?? "-",
      }),
      detail:
        matchMethod === "rule" && rule
          ? t("ruleDetail.configuredMapping")
          : t("ruleDetail.autoDetected"),
    },
    {
      kind: "amount",
      label:
        amountDiff === 0
          ? t("criteria.exactAmount")
          : t("criteria.amountDiff", {
              difference: formatCurrency(amountDiff, pair.currency),
            }),
      detail:
        rule?.amountDrift != null
          ? t("ruleDetail.amountTolerance", {
              tolerance: formatCurrency(rule.amountDrift, pair.currency),
            })
          : t("ruleDetail.defaultAmountTolerance"),
    },
    {
      kind: "date",
      label:
        dayDrift === 0
          ? t("criteria.sameDate")
          : typeof dayDrift === "number"
            ? t("criteria.dayDrift", { count: Math.abs(dayDrift) })
            : t("criteria.sameDate"),
      detail:
        matchMethod === "rule" && rule
          ? t("ruleDetail.maxDayDrift", { max: rule.dayDrift })
          : t("ruleDetail.exactDateRequired"),
    },
  ];

  const canEditTolerance = Boolean(sourceFieldName && targetFieldName);

  return (
    <div
      className="rounded-md border border-border bg-muted/40 px-3 py-2"
      data-testid={`pair-${index}-match-criteria`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {criteria.map((criterion) => {
          const isEditable =
            (criterion.kind === "amount" || criterion.kind === "date") &&
            canEditTolerance;
          const hasOverride =
            (criterion.kind === "amount" &&
              overrideRule?.amountDrift !== undefined) ||
            (criterion.kind === "date" &&
              overrideRule?.dayDrift !== undefined);

          if (!isEditable) {
            return (
              <span
                key={criterion.kind}
                className="rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground"
                data-testid={`pair-${index}-criterion-${criterion.kind}`}
              >
                {criterion.label}
              </span>
            );
          }

          return (
            <Popover key={criterion.kind}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`group inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed bg-background px-2 py-1 text-xs transition-colors hover:border-primary hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    hasOverride
                      ? "border-primary text-primary"
                      : "border-primary/40 text-foreground"
                  }`}
                  title={t("ruleDetail.clickToEdit")}
                  data-testid={`pair-${index}-criterion-${criterion.kind}`}
                >
                  <span>{criterion.label}</span>
                  <Pencil
                    className="h-3 w-3 opacity-60 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                className="w-auto max-w-xs p-3"
                data-testid={`pair-${index}-criterion-popover-${criterion.kind}`}
              >
                {criterion.kind === "amount" ? (
                  <AmountToleranceEditor
                    rule={rule}
                    overrideRule={overrideRule}
                    currency={pair.currency}
                    detail={criterion.detail}
                    sourceFieldName={sourceFieldName as string}
                    targetFieldName={targetFieldName as string}
                    onChange={updateFieldMappingOverride}
                  />
                ) : (
                  <DayDriftEditor
                    rule={rule}
                    overrideRule={overrideRule}
                    detail={criterion.detail}
                    sourceFieldName={sourceFieldName as string}
                    targetFieldName={targetFieldName as string}
                    onChange={updateFieldMappingOverride}
                  />
                )}
              </PopoverContent>
            </Popover>
          );
        })}
        {hasOppositeSigns && (
          <span
            className="rounded-md border border-yellow-500/40 bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-600"
            data-testid={`pair-${index}-criterion-opposite-signs`}
          >
            {t("criteria.oppositeSigns")}
          </span>
        )}
      </div>
    </div>
  );
}

interface AmountToleranceEditorProps {
  rule: ToleranceReconcilePair | undefined;
  overrideRule: ToleranceReconcilePair | undefined;
  currency: string;
  detail: string;
  sourceFieldName: string;
  targetFieldName: string;
  onChange: (
    sourceFieldName: string,
    targetFieldName: string,
    updates: Partial<ToleranceReconcilePair>
  ) => void;
}

function AmountToleranceEditor({
  rule,
  overrideRule,
  currency,
  detail,
  sourceFieldName,
  targetFieldName,
  onChange,
}: AmountToleranceEditorProps) {
  const t = useTranslations("reconciliation.suggestedPairs");
  const initial = rule?.amountDrift ?? 0;
  const [value, setValue] = useState<string>(String(initial));

  // Keep the input in sync if the rule changes externally.
  useEffect(() => {
    setValue(String(rule?.amountDrift ?? 0));
  }, [rule?.amountDrift]);

  const commit = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setValue(String(rule?.amountDrift ?? 0));
      return;
    }
    if (parsed !== (rule?.amountDrift ?? 0)) {
      onChange(sourceFieldName, targetFieldName, { amountDrift: parsed });
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{detail}</p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-foreground">
          {t("ruleDetail.editAmountTolerance")}
        </span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className="h-8 text-xs"
          data-testid={`amount-tolerance-input-${sourceFieldName}-${targetFieldName}`}
        />
        <span className="text-[10px] text-muted-foreground">
          {formatCurrency(Number(value) || 0, currency)}
        </span>
      </label>
      {overrideRule?.amountDrift != null && (
        <p className="text-[10px] font-medium text-primary">
          {t("ruleDetail.overrideApplied")}
        </p>
      )}
    </div>
  );
}

interface DayDriftEditorProps {
  rule: ToleranceReconcilePair | undefined;
  overrideRule: ToleranceReconcilePair | undefined;
  detail: string;
  sourceFieldName: string;
  targetFieldName: string;
  onChange: (
    sourceFieldName: string,
    targetFieldName: string,
    updates: Partial<ToleranceReconcilePair>
  ) => void;
}

function DayDriftEditor({
  rule,
  overrideRule,
  detail,
  sourceFieldName,
  targetFieldName,
  onChange,
}: DayDriftEditorProps) {
  const t = useTranslations("reconciliation.suggestedPairs");
  const initial = rule?.dayDrift ?? 0;
  const [value, setValue] = useState<string>(String(initial));

  useEffect(() => {
    setValue(String(rule?.dayDrift ?? 0));
  }, [rule?.dayDrift]);

  const commit = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      setValue(String(rule?.dayDrift ?? 0));
      return;
    }
    if (parsed !== (rule?.dayDrift ?? 0)) {
      onChange(sourceFieldName, targetFieldName, { dayDrift: parsed });
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{detail}</p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-foreground">
          {t("ruleDetail.editDayDrift")}
        </span>
        <Input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className="h-8 text-xs"
          data-testid={`day-drift-input-${sourceFieldName}-${targetFieldName}`}
        />
      </label>
      {overrideRule?.dayDrift != null && (
        <p className="text-[10px] font-medium text-primary">
          {t("ruleDetail.overrideApplied")}
        </p>
      )}
    </div>
  );
}
