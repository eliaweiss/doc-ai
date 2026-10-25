import { cn } from "../../../lib/utils";
import { getCurrencySymbol } from "@zdocs/util";

export default function FormatCurrency({
  amount,
  currency,
  className,
}: {
  amount: number | string | null;
  currency?: string | null;
  className?: string;
}) {
  if (amount === null || amount === undefined) return <span>-</span>;

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return <span>{amount}</span>;

  // Format the number without currency symbol
  const formattedNumber = new Intl.NumberFormat(undefined, {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  const currencySymbol = currency ? getCurrencySymbol(currency) : null;

  return (
    <span
      className={cn("inline-flex items-baseline", className)}
      data-testid="format-currency"
    >
      {currencySymbol && (
        <span className="text-[0.8em] mr-0.5" data-testid="currency-symbol">
          {currencySymbol}
        </span>
      )}
      <span className="font-bold" data-testid="currency-amount">
        {formattedNumber}
      </span>
    </span>
  );
}
