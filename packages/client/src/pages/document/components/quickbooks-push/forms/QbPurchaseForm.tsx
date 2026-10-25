"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import type { QuickBooksPurchaseMapping } from "@zdocs/types";
import {
  fetchQbAccounts,
  type QbAccountItem,
} from "../../../../../utilities/api/quickbooksDocumentApi";
import { useLogUserJourneyEvent } from "../../../../../utilities/api/logUserJourneyEventApi";

const PAYMENT_TYPES: Array<"Cash" | "Check" | "CreditCard"> = [
  "CreditCard",
  "Cash",
  "Check",
];

const PAYMENT_ACCOUNT_TYPES: Record<string, string[]> = {
  CreditCard: ["Credit Card"],
  Cash: ["Bank", "Other Current Asset", "Cash and Cash Equivalents"],
  Check: ["Bank", "Other Current Asset"],
};

interface QbPurchaseFormProps {
  orgId: string;
  documentId: string;
  savedMapping: QuickBooksPurchaseMapping | null;
  onReady: (mapping: QuickBooksPurchaseMapping) => void;
  onLoadError: (err: string) => void;
  onLoadComplete: () => void;
}

export function QbPurchaseForm({
  orgId,
  documentId,
  savedMapping,
  onReady,
  onLoadError,
  onLoadComplete,
}: QbPurchaseFormProps) {
  const t = useTranslations("documentPage.quickbooks");
  const { logEvent } = useLogUserJourneyEvent();
  const [accounts, setAccounts] = useState<QbAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [paymentType, setPaymentType] = useState<"Cash" | "Check" | "CreditCard">(
    savedMapping?.paymentType ?? "CreditCard"
  );
  const [paymentAccountId, setPaymentAccountId] = useState<string>(
    savedMapping?.paymentAccountRef?.value ?? ""
  );
  const [expenseAccountId, setExpenseAccountId] = useState<string>(
    savedMapping?.expenseAccountRef?.value ?? ""
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { accounts: fetched } = await fetchQbAccounts(orgId, documentId);
      setAccounts(fetched);

      if (fetched.length > 0) {
        const savedPaymentExists = fetched.some((a) => a.id === savedMapping?.paymentAccountRef?.value);
        if (!savedPaymentExists) {
          const validTypes = PAYMENT_ACCOUNT_TYPES[savedMapping?.paymentType ?? paymentType] ?? [];
          const def = fetched.find((a) => validTypes.includes(a.accountType)) ?? fetched[0];
          if (def) setPaymentAccountId(def.id);
        }
      }

      if (fetched.length > 0) {
        const savedExpenseExists = fetched.some((a) => a.id === savedMapping?.expenseAccountRef?.value);
        if (!savedExpenseExists) {
          const def =
            fetched.find((a) => a.accountType === "Expense") ??
            fetched.find((a) => a.accountType === "Other Expense") ??
            fetched[0];
          if (def) setExpenseAccountId(def.id);
        }
      }

      onLoadComplete();
    } catch (err) {
      onLoadError(err instanceof Error ? err.message : t("accountsFetchFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, documentId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const paymentAccount = accounts.find((a) => a.id === paymentAccountId);
    const expenseAccount = accounts.find((a) => a.id === expenseAccountId);
    if (paymentAccount && expenseAccount) {
      const mapping: QuickBooksPurchaseMapping = {
        paymentType,
        paymentAccountRef: { name: paymentAccount.name, value: paymentAccount.id },
        expenseAccountRef: { name: expenseAccount.name, value: expenseAccount.id },
      };
      onReady(mapping);
      try {
        localStorage.setItem(`qb-push:${orgId}:Purchase`, JSON.stringify(mapping));
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentType, paymentAccountId, expenseAccountId, accounts]);

  const preferredPaymentTypes = PAYMENT_ACCOUNT_TYPES[paymentType] ?? [];
  const filteredPaymentAccounts = accounts.filter((a) =>
    preferredPaymentTypes.includes(a.accountType)
  );
  const paymentAccounts =
    filteredPaymentAccounts.length > 0 ? filteredPaymentAccounts : accounts;

  const filteredExpenseAccounts = accounts.filter(
    (a) =>
      a.accountType === "Expense" ||
      a.accountType === "Other Expense" ||
      a.accountType === "Cost of Goods Sold"
  );
  const expenseAccounts =
    filteredExpenseAccounts.length > 0 ? filteredExpenseAccounts : accounts;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="qb-purchase-form-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" data-testid="qb-purchase-form">
      <div className="space-y-1.5" data-testid="qb-purchase-payment-type">
        <Label>{t("paymentType")}</Label>
        <p className="text-xs text-muted-foreground">{t("paymentTypeHint")}</p>
        <Select
          value={paymentType}
          onValueChange={(v) => {
            logEvent({ eventType: "qb_push_purchase_payment_type_changed", eventData: { documentId, paymentType: v } });
            setPaymentType(v as "Cash" | "Check" | "CreditCard");
            setPaymentAccountId("");
          }}
        >
          <SelectTrigger data-testid="qb-purchase-payment-type-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_TYPES.map((pt) => (
              <SelectItem key={pt} value={pt}>
                {t(`paymentTypeOption.${pt}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="qb-purchase-payment-account">
        <Label>{t("paymentAccount")}</Label>
        <p className="text-xs text-muted-foreground">{t("paymentAccountHint")}</p>
        <Select value={paymentAccountId} onValueChange={(v) => {
          logEvent({ eventType: "qb_push_purchase_payment_account_changed", eventData: { documentId } });
          setPaymentAccountId(v);
        }}>
          <SelectTrigger data-testid="qb-purchase-payment-account-trigger">
            <SelectValue placeholder={t("selectAccount")} />
          </SelectTrigger>
          <SelectContent>
            {paymentAccounts.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {t("noMatchingAccounts")}
              </div>
            ) : (
              paymentAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  <span className="ml-2 text-muted-foreground text-xs">({a.accountType})</span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="qb-purchase-expense-account">
        <Label>{t("expenseAccount")}</Label>
        <p className="text-xs text-muted-foreground">{t("expenseAccountHint")}</p>
        <Select value={expenseAccountId} onValueChange={(v) => {
          logEvent({ eventType: "qb_push_purchase_expense_account_changed", eventData: { documentId } });
          setExpenseAccountId(v);
        }}>
          <SelectTrigger data-testid="qb-purchase-expense-account-trigger">
            <SelectValue placeholder={t("selectAccount")} />
          </SelectTrigger>
          <SelectContent>
            {expenseAccounts.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {t("noMatchingAccounts")}
              </div>
            ) : (
              expenseAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  <span className="ml-2 text-muted-foreground text-xs">({a.accountType})</span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
