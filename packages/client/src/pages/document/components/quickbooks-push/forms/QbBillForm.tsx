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
import { Input } from "@zdocs/client-component";
import type { QbBillMapping } from "@zdocs/types";
import {
  fetchQbVendors,
  fetchQbAccounts,
  type QbVendorItem,
  type QbAccountItem,
} from "../../../../../utilities/api/quickbooksDocumentApi";
import { useLogUserJourneyEvent } from "../../../../../utilities/api/logUserJourneyEventApi";

interface QbBillFormProps {
  orgId: string;
  documentId: string;
  initialVendorId?: string | null;
  initialExpenseAccountId?: string | null;
  initialDueDate?: string | null;
  onReady: (mapping: QbBillMapping) => void;
  onLoadError: (err: string) => void;
  onLoadComplete: () => void;
}

export function QbBillForm({
  orgId,
  documentId,
  initialVendorId,
  initialExpenseAccountId,
  initialDueDate,
  onReady,
  onLoadError,
  onLoadComplete,
}: QbBillFormProps) {
  const t = useTranslations("documentPage.quickbooks");
  const { logEvent } = useLogUserJourneyEvent();
  const [vendors, setVendors] = useState<QbVendorItem[]>([]);
  const [accounts, setAccounts] = useState<QbAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorId, setVendorId] = useState(initialVendorId ?? "");
  const [expenseAccountId, setExpenseAccountId] = useState(initialExpenseAccountId ?? "");
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorResult, accountResult] = await Promise.all([
        fetchQbVendors(orgId, documentId),
        fetchQbAccounts(orgId, documentId),
      ]);
      setVendors(vendorResult.vendors);
      setAccounts(accountResult.accounts);

      if (vendorResult.vendors.length > 0) {
        const savedExists = vendorResult.vendors.some((v) => v.id === initialVendorId);
        if (!savedExists) setVendorId(vendorResult.vendors[0].id);
      }
      const expenseAccts = accountResult.accounts.filter(
        (a) =>
          a.accountType === "Expense" ||
          a.accountType === "Other Expense" ||
          a.accountType === "Cost of Goods Sold"
      );
      if (expenseAccts.length > 0 || accountResult.accounts.length > 0) {
        const savedExists = accountResult.accounts.some((a) => a.id === initialExpenseAccountId);
        if (!savedExists) {
          const fallback = expenseAccts[0] ?? accountResult.accounts[0];
          if (fallback) setExpenseAccountId(fallback.id);
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
    void load();
  }, [load]);

  useEffect(() => {
    const vendor = vendors.find((v) => v.id === vendorId);
    const account = accounts.find((a) => a.id === expenseAccountId);
    if (vendor && account) {
      const mapping: QbBillMapping = {
        vendorRef: { name: vendor.displayName, value: vendor.id },
        expenseAccountRef: { name: account.name, value: account.id },
        dueDate: dueDate || null,
      };
      onReady(mapping);
      try {
        localStorage.setItem(`qb-push:${orgId}:Bill`, JSON.stringify(mapping));
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, expenseAccountId, dueDate, vendors, accounts]);

  const expenseAccounts = accounts.filter(
    (a) =>
      a.accountType === "Expense" ||
      a.accountType === "Other Expense" ||
      a.accountType === "Cost of Goods Sold"
  );
  const displayAccounts = expenseAccounts.length > 0 ? expenseAccounts : accounts;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="qb-bill-form-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" data-testid="qb-bill-form">
      <div className="space-y-1.5" data-testid="qb-bill-vendor">
        <Label>{t("vendor")}</Label>
        <Select value={vendorId} onValueChange={(v) => {
          logEvent({ eventType: "qb_push_bill_vendor_changed", eventData: { documentId } });
          setVendorId(v);
        }}>
          <SelectTrigger data-testid="qb-bill-vendor-trigger">
            <SelectValue placeholder={t("selectVendor")} />
          </SelectTrigger>
          <SelectContent>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="qb-bill-expense-account">
        <Label>{t("expenseAccount")}</Label>
        <Select value={expenseAccountId} onValueChange={(v) => {
          logEvent({ eventType: "qb_push_bill_expense_account_changed", eventData: { documentId } });
          setExpenseAccountId(v);
        }}>
          <SelectTrigger data-testid="qb-bill-expense-account-trigger">
            <SelectValue placeholder={t("selectAccount")} />
          </SelectTrigger>
          <SelectContent>
            {displayAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                <span className="ml-2 text-muted-foreground text-xs">({a.accountType})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="qb-bill-due-date">
        <Label>{t("dueDate")}</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          data-testid="qb-bill-due-date-input"
        />
      </div>
    </div>
  );
}
