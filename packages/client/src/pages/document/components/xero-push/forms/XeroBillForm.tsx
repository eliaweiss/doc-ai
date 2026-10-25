"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { XeroBillMapping } from "@zdocs/types";
import {
  fetchXeroChartAccounts,
  fetchXeroContacts,
  fetchXeroTaxRates,
  type XeroChartAccountItem,
  type XeroContactItem,
  type XeroTaxRateItem,
} from "../../../../../utilities/api/xeroDocumentApi";
import { useLogUserJourneyEvent } from "../../../../../utilities/api/logUserJourneyEventApi";

const NO_TAX_RATE = "__none";
const EXPENSE_ACCOUNT_TYPES = ["EXPENSE", "DIRECTCOSTS", "OVERHEADS"];

interface XeroBillFormProps {
  orgId: string;
  documentId: string;
  initialContactId?: string | null;
  initialExpenseAccountCode?: string | null;
  initialTaxType?: string | null;
  initialDueDate?: string | null;
  onReady: (mapping: XeroBillMapping) => void;
  onLoadError: (err: string) => void;
  onLoadComplete: () => void;
}

export function XeroBillForm({
  orgId,
  documentId,
  initialContactId,
  initialExpenseAccountCode,
  initialTaxType,
  initialDueDate,
  onReady,
  onLoadError,
  onLoadComplete,
}: XeroBillFormProps) {
  const t = useTranslations("documentPage.xero");
  const { logEvent } = useLogUserJourneyEvent();
  const [contacts, setContacts] = useState<XeroContactItem[]>([]);
  const [accounts, setAccounts] = useState<XeroChartAccountItem[]>([]);
  const [taxRates, setTaxRates] = useState<XeroTaxRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactId, setContactId] = useState(initialContactId ?? "");
  const [expenseAccountCode, setExpenseAccountCode] = useState(
    initialExpenseAccountCode ?? ""
  );
  const [taxType, setTaxType] = useState(initialTaxType ?? NO_TAX_RATE);
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contactResult, accountResults, taxResult] = await Promise.all([
        fetchXeroContacts(orgId),
        Promise.all(
          EXPENSE_ACCOUNT_TYPES.map((accountType) =>
            fetchXeroChartAccounts(orgId, accountType)
          )
        ),
        fetchXeroTaxRates(orgId),
      ]);
      const mergedAccounts = accountResults.flatMap((result) => result.accounts);

      setContacts(contactResult.contacts);
      setAccounts(mergedAccounts);
      setTaxRates(taxResult.taxRates);

      if (contactResult.contacts.length > 0) {
        const savedExists = contactResult.contacts.some((c) => c.id === initialContactId);
        if (!savedExists) setContactId(contactResult.contacts[0].id);
      }
      if (mergedAccounts.length > 0) {
        const savedExists = mergedAccounts.some(
          (account) => account.code === initialExpenseAccountCode
        );
        if (!savedExists) setExpenseAccountCode(mergedAccounts[0].code);
      }
      if (initialTaxType && taxResult.taxRates.some((rate) => rate.taxType === initialTaxType)) {
        setTaxType(initialTaxType);
      }
      onLoadComplete();
    } catch (err) {
      onLoadError(err instanceof Error ? err.message : t("dataFetchFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uniqueAccounts = useMemo(() => {
    const byCode = new Map<string, XeroChartAccountItem>();
    accounts.forEach((account) => {
      if (account.code) byCode.set(account.code, account);
    });
    return [...byCode.values()];
  }, [accounts]);

  useEffect(() => {
    const contact = contacts.find((c) => c.id === contactId);
    const account = uniqueAccounts.find((a) => a.code === expenseAccountCode);
    const selectedTaxRate = taxRates.find((rate) => rate.taxType === taxType);
    if (contact && account) {
      const mapping: XeroBillMapping = {
        contactRef: { name: contact.name, value: contact.id },
        expenseAccountRef: {
          name: account.code ? `${account.code} - ${account.name}` : account.name,
          value: account.code,
        },
        taxTypeRef: selectedTaxRate
          ? { name: selectedTaxRate.name, value: selectedTaxRate.taxType }
          : null,
        dueDate: dueDate || null,
      };
      onReady(mapping);
      try {
        localStorage.setItem(`xero-push:${orgId}:Bill`, JSON.stringify(mapping));
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, expenseAccountCode, taxType, dueDate, contacts, uniqueAccounts, taxRates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="xero-bill-form-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" data-testid="xero-bill-form">
      <div className="space-y-1.5" data-testid="xero-bill-contact">
        <Label>{t("contact")}</Label>
        <Select
          value={contactId}
          onValueChange={(value) => {
            logEvent({ eventType: "xero_push_bill_contact_changed", eventData: { documentId } });
            setContactId(value);
          }}
        >
          <SelectTrigger data-testid="xero-bill-contact-trigger">
            <SelectValue placeholder={t("selectContact")} />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id}>
                {contact.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="xero-bill-expense-account">
        <Label>{t("expenseAccount")}</Label>
        <Select
          value={expenseAccountCode}
          onValueChange={(value) => {
            logEvent({ eventType: "xero_push_bill_account_changed", eventData: { documentId } });
            setExpenseAccountCode(value);
          }}
        >
          <SelectTrigger data-testid="xero-bill-expense-account-trigger">
            <SelectValue placeholder={t("selectAccount")} />
          </SelectTrigger>
          <SelectContent>
            {uniqueAccounts.map((account) => (
              <SelectItem key={account.id} value={account.code}>
                {account.code ? `${account.code} - ${account.name}` : account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="xero-bill-tax-rate">
        <Label>{t("taxRate")}</Label>
        <Select value={taxType} onValueChange={setTaxType}>
          <SelectTrigger data-testid="xero-bill-tax-rate-trigger">
            <SelectValue placeholder={t("selectTaxRate")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TAX_RATE}>{t("noTaxRate")}</SelectItem>
            {taxRates.map((rate) => (
              <SelectItem key={rate.taxType} value={rate.taxType}>
                {rate.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="xero-bill-due-date">
        <Label>{t("dueDate")}</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          data-testid="xero-bill-due-date-input"
        />
      </div>
    </div>
  );
}
