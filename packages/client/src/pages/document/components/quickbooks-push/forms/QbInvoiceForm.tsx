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
import type { QbInvoiceMapping } from "@zdocs/types";
import {
  fetchQbCustomers,
  fetchQbItems,
  type QbCustomerItem,
  type QbItemOption,
} from "../../../../../utilities/api/quickbooksDocumentApi";
import { useLogUserJourneyEvent } from "../../../../../utilities/api/logUserJourneyEventApi";

interface QbInvoiceFormProps {
  orgId: string;
  documentId: string;
  initialCustomerId?: string | null;
  initialItemId?: string | null;
  initialDueDate?: string | null;
  onReady: (mapping: QbInvoiceMapping) => void;
  onLoadError: (err: string) => void;
  onLoadComplete: () => void;
}

export function QbInvoiceForm({
  orgId,
  documentId,
  initialCustomerId,
  initialItemId,
  initialDueDate,
  onReady,
  onLoadError,
  onLoadComplete,
}: QbInvoiceFormProps) {
  const t = useTranslations("documentPage.quickbooks");
  const { logEvent } = useLogUserJourneyEvent();
  const [customers, setCustomers] = useState<QbCustomerItem[]>([]);
  const [items, setItems] = useState<QbItemOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [itemId, setItemId] = useState(initialItemId ?? "");
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [custResult, itemResult] = await Promise.all([
        fetchQbCustomers(orgId, documentId),
        fetchQbItems(orgId, documentId),
      ]);
      setCustomers(custResult.customers);
      setItems(itemResult.items);

      if (custResult.customers.length > 0) {
        const savedExists = custResult.customers.some((c) => c.id === initialCustomerId);
        if (!savedExists) setCustomerId(custResult.customers[0].id);
      }
      if (itemResult.items.length > 0) {
        const savedExists = itemResult.items.some((i) => i.id === initialItemId);
        if (!savedExists) setItemId(itemResult.items[0].id);
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
    const customer = customers.find((c) => c.id === customerId);
    const item = items.find((i) => i.id === itemId);
    if (customer && item) {
      const mapping: QbInvoiceMapping = {
        customerRef: { name: customer.displayName, value: customer.id },
        itemRef: { name: item.name, value: item.id },
        dueDate: dueDate || null,
      };
      onReady(mapping);
      try {
        localStorage.setItem(`qb-push:${orgId}:Invoice`, JSON.stringify(mapping));
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, itemId, dueDate, customers, items]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="qb-invoice-form-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" data-testid="qb-invoice-form">
      <div className="space-y-1.5" data-testid="qb-invoice-customer">
        <Label>{t("customer")}</Label>
        <Select value={customerId} onValueChange={(v) => {
          logEvent({ eventType: "qb_push_invoice_customer_changed", eventData: { documentId } });
          setCustomerId(v);
        }}>
          <SelectTrigger data-testid="qb-invoice-customer-trigger">
            <SelectValue placeholder={t("selectCustomer")} />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="qb-invoice-item">
        <Label>{t("serviceItem")}</Label>
        <Select value={itemId} onValueChange={(v) => {
          logEvent({ eventType: "qb_push_invoice_item_changed", eventData: { documentId } });
          setItemId(v);
        }}>
          <SelectTrigger data-testid="qb-invoice-item-trigger">
            <SelectValue placeholder={t("selectItem")} />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
                <span className="ml-2 text-muted-foreground text-xs">({i.type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5" data-testid="qb-invoice-due-date">
        <Label>{t("dueDate")}</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          data-testid="qb-invoice-due-date-input"
        />
      </div>
    </div>
  );
}
