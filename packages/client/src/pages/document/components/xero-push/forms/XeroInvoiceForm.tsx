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
import type { XeroInvoiceMapping } from "@zdocs/types";
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

interface XeroInvoiceFormProps {
  orgId: string;
  documentId: string;
  initialContactId?: string | null;
  initialAccountCode?: string | null;
  initialTaxType?: string | null;
  initialDueDate?: string | null;
  onReady: (mapping: XeroInvoiceMapping) => void;
  onLoadError: (err: string) => void;
  onLoadComplete: () => void;
}

export function XeroInvoiceForm({
  orgId,
  documentId,
  initialContactId,
  initialAccountCode,
  initialTaxType,
  initialDueDate,
  onReady,
  onLoadError,
  onLoadComplete,
}: XeroInvoiceFormProps) {
  const t = useTranslations("documentPage.xero");
  const { logEvent } = useLogUserJourneyEvent();
  const [contacts, setContacts] = useState<XeroContactItem[]>([]);
  const [accounts, setAccounts] = useState<XeroChartAccountItem[]>([]);
  const [taxRates, setTaxRates] = useState<XeroTaxRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactId, setContactId] = useState(initialContactId ?? "");
  const [accountCode, setAccountCode] = useState(initialAccountCode ?? "");
  const [taxType, setTaxType] = useState(initialTaxType ?? NO_TAX_RATE);
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contactResult, accountResult, taxResult] = await Promise.all([
        fetchXeroContacts(orgId),
        fetchXeroChartAccounts(orgId, "REVENUE"),
        fetchXeroTaxRates(orgId),
      ]);

      setContacts(contactResult.contacts);
      setAccounts(accountResult.accounts);
      setTaxRates(taxResult.taxRates);

      if (contactResult.contacts.length > 0) {
        const savedExists = contactResult.contacts.some((c) => c.id === initialContactId);
        if (!savedExists) setContactId(contactResult.contacts[0].id);
      }
      if (accountResult.accounts.length > 0) {
        const savedExists = accountResult.accounts.some((a) => a.code === initialAccountCode);
        if (!savedExists) setAccountCode(accountResult.accounts[0].code);
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

  useEffect(() => {
    const contact = contacts.find((c) => c.id === contactId);
    const account = accounts.find((a) => a.code === accountCode);
    const selectedTaxRate = taxRates.find((rate) => rate.taxType === taxType);
    if (contact && account) {
      const mapping: XeroInvoiceMapping = {
        contactRef: { name: contact.name, value: contact.id },
        accountRef: {
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
        localStorage.setItem(`xero-push:${orgId}:Invoice`, JSON.stringify(mapping));
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, accountCode, taxType, dueDate, contacts, accounts, taxRates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="xero-invoice-form-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" data-testid="xero-invoice-form">
      <div className="space-y-1.5" data-testid="xero-invoice-contact">
        <Label>{t("contact")}</Label>
        <Select
          value={contactId}
          onValueChange={(value) => {
            logEvent({ eventType: "xero_push_invoice_contact_changed", eventData: { documentId } });
            setContactId(value);
          }}
        >
          <SelectTrigger data-testid="xero-invoice-contact-trigger">
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

      <div className="space-y-1.5" data-testid="xero-invoice-account">
        <Label>{t("revenueAccount")}</Label>
        <Select
          value={accountCode}
          onValueChange={(value) => {
            logEvent({ eventType: "xero_push_invoice_account_changed", eventData: { documentId } });
            setAccountCode(value);
          }}
        >
          <SelectTrigger data-testid="xero-invoice-account-trigger">
            <SelectValue placeholder={t("selectAccount")} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.code}>
                {account.code ? `${account.code} - ${account.name}` : account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="xero-invoice-tax-rate">
        <Label>{t("taxRate")}</Label>
        <Select value={taxType} onValueChange={setTaxType}>
          <SelectTrigger data-testid="xero-invoice-tax-rate-trigger">
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

      <div className="space-y-1.5" data-testid="xero-invoice-due-date">
        <Label>{t("dueDate")}</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          data-testid="xero-invoice-due-date-input"
        />
      </div>
    </div>
  );
}
