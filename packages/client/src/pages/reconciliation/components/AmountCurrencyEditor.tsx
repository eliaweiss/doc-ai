"use client";

import { useTranslations } from "next-intl";
import { Plus, Minus } from "lucide-react";
import { cn } from "@zdocs/util";

interface AmountCurrencyEditorProps {
  amount: number | null;
  currency: string;
  availableCurrencies: string[];
  onAmountChange: (amount: number | null) => void;
  onCurrencyChange: (currency: string) => void;
  hasOppositeSign?: boolean; // Show +/- toggle buttons
  signChoiceMade?: boolean; // Whether user has explicitly chosen a sign
  onSetPositive?: () => void; // Callback for + button
  onSetNegative?: () => void; // Callback for - button
  compact?: boolean; // For smaller inline display (dialog use)
  testIdPrefix?: string;
}

export function AmountCurrencyEditor({
  amount,
  currency,
  availableCurrencies,
  onAmountChange,
  onCurrencyChange,
  hasOppositeSign,
  signChoiceMade,
  onSetPositive,
  onSetNegative,
  compact = false,
  testIdPrefix = "",
}: AmountCurrencyEditorProps) {
  const t = useTranslations("reconciliation.amountEditor");

  return (
    <div
      className={cn("flex items-center gap-2", compact ? "gap-1" : "gap-2")}
      data-testid={`${testIdPrefix}amount-currency-editor`}
    >
      {hasOppositeSign && (
        <div className="flex items-center gap-1">
          <button
            onClick={onSetPositive}
            className={cn(
              "p-1.5 rounded border transition-colors",
              signChoiceMade && amount !== null && amount >= 0
                ? "bg-green-100 border-green-500 text-green-700"
                : "border-border text-muted-foreground hover:bg-accent",
              compact && "p-1"
            )}
            title={t("setPositive")}
            type="button"
            data-testid={`${testIdPrefix}set-positive-btn`}
          >
            <Plus className={cn("w-4 h-4", compact && "w-3 h-3")} />
          </button>
          <button
            onClick={onSetNegative}
            className={cn(
              "p-1.5 rounded border transition-colors",
              signChoiceMade && amount !== null && amount < 0
                ? "bg-red-100 border-red-500 text-red-700"
                : "border-border text-muted-foreground hover:bg-accent",
              compact && "p-1"
            )}
            title={t("setNegative")}
            type="button"
            data-testid={`${testIdPrefix}set-negative-btn`}
          >
            <Minus className={cn("w-4 h-4", compact && "w-3 h-3")} />
          </button>
        </div>
      )}

      <input
        type="number"
        placeholder={t("amountPlaceholder")}
        value={amount !== null ? amount.toString() : ""}
        onChange={(e) =>
          onAmountChange(e.target.value ? Number(e.target.value) : null)
        }
        className={cn(
          "p-2 border rounded",
          compact ? "w-24 p-1 text-sm" : "w-32"
        )}
        data-testid={`${testIdPrefix}amount-input`}
      />

      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className={cn(
          "p-2 border rounded",
          compact ? "p-1 text-sm" : ""
        )}
        data-testid={`${testIdPrefix}currency-select`}
      >
        {availableCurrencies.map((curr) => (
          <option key={curr} value={curr}>
            {curr}
          </option>
        ))}
      </select>
    </div>
  );
}
