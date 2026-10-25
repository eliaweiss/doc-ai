"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { toast } from "sonner";
import type {
  QbEntityType,
  QuickBooksPurchaseMapping,
  QbInvoiceMapping,
  QbBillMapping,
  QuickBooksPushBody,
} from "@zdocs/types";
import { pushDocumentToQuickBooks } from "../../../../utilities/api/quickbooksDocumentApi";
import { startQuickBooksOAuth } from "../../../../utilities/api/quickbooksIntegrationApi";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";
import { QbTypePickerStep, type QbDirection } from "./QbTypePickerStep";
import { QbPurchaseForm } from "./forms/QbPurchaseForm";
import { QbInvoiceForm } from "./forms/QbInvoiceForm";
import { QbBillForm } from "./forms/QbBillForm";

type Step = "pick-type" | "form";

function preselectedDirection(docType: string | null | undefined): QbDirection {
  if (docType === "RECEIPT") return "expense";
  if (docType === "INVOICE") return "expense";
  return "expense";
}

/**
 * Map the user-facing direction to the QB entity type.
 * Income -> Invoice (customer invoice)
 * Expense -> Purchase if doc is a receipt (already paid), Bill otherwise (unpaid)
 */
function directionToEntityType(
  direction: QbDirection,
  docType: string | null | undefined
): QbEntityType {
  if (direction === "income") return "Invoice";
  if (docType === "RECEIPT") return "Purchase";
  return "Bill";
}

function storageKey(orgId: string, entityType: QbEntityType) {
  return `qb-push:${orgId}:${entityType}`;
}

function directionStorageKey(orgId: string) {
  return `qb-push:${orgId}:direction`;
}

function loadCachedMapping<T>(orgId: string, entityType: QbEntityType): T | null {
  try {
    const raw = localStorage.getItem(storageKey(orgId, entityType));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function loadCachedDirection(orgId: string): QbDirection | null {
  try {
    const raw = localStorage.getItem(directionStorageKey(orgId));
    return raw === "income" || raw === "expense" ? raw : null;
  } catch {
    return null;
  }
}

function saveCachedDirection(orgId: string, direction: QbDirection) {
  try {
    localStorage.setItem(directionStorageKey(orgId), direction);
  } catch {
    /* ignore */
  }
}

interface QuickBooksPushDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  documentId: string;
  docType: string | null | undefined;
  savedMapping: QuickBooksPurchaseMapping | null;
  onPushed: () => void;
}

export function QuickBooksPushDialog({
  isOpen,
  onClose,
  orgId,
  documentId,
  docType,
  savedMapping,
  onPushed,
}: QuickBooksPushDialogProps) {
  const t = useTranslations("documentPage.quickbooks");
  const { logEvent } = useLogUserJourneyEvent();

  const [step, setStep] = useState<Step>("pick-type");
  const [selectedDirection, setSelectedDirection] = useState<QbDirection>(
    preselectedDirection(docType)
  );
  const [pushing, setPushing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formLoaded, setFormLoaded] = useState(false);

  const currentMappingRef = useRef<QuickBooksPushBody["mapping"] | null>(null);

  const resolvedEntityType = directionToEntityType(selectedDirection, docType);

  useEffect(() => {
    if (isOpen) {
      setStep("pick-type");
      setSelectedDirection(loadCachedDirection(orgId) ?? preselectedDirection(docType));
      setFetchError(null);
      setFormLoaded(false);
      currentMappingRef.current = null;
      logEvent({
        eventType: "qb_push_type_picker_opened",
        eventData: { documentId },
      });
    }
  }, [isOpen, docType, documentId, orgId, logEvent]);

  const handleDirectionSelect = useCallback(
    (dir: QbDirection) => {
      setSelectedDirection(dir);
      saveCachedDirection(orgId, dir);
      logEvent({
        eventType: "qb_push_type_selected",
        eventData: { documentId, direction: dir },
      });
    },
    [orgId, documentId, logEvent]
  );

  const handleContinue = useCallback(() => {
    setStep("form");
    setFetchError(null);
    setFormLoaded(false);
    currentMappingRef.current = null;
  }, []);

  const handleBack = useCallback(() => {
    logEvent({
      eventType: "qb_push_back_to_type_picker",
      eventData: { documentId, direction: selectedDirection },
    });
    setStep("pick-type");
    setFetchError(null);
    setFormLoaded(false);
    currentMappingRef.current = null;
  }, [documentId, logEvent, selectedDirection]);

  const handleLoadError = useCallback(
    (err: string) => {
      setFetchError(err);
      logEvent({
        eventType: "qb_push_accounts_load_error",
        eventData: { documentId, direction: selectedDirection },
      });
    },
    [documentId, logEvent, selectedDirection]
  );

  const handleLoadComplete = useCallback(() => {
    setFormLoaded(true);
    logEvent({
      eventType: `qb_push_${resolvedEntityType.toLowerCase()}_data_loaded`,
      eventData: { documentId, entityType: resolvedEntityType },
    });
  }, [resolvedEntityType, documentId, logEvent]);

  const handlePush = async () => {
    const mapping = currentMappingRef.current;
    if (!mapping) return;

    const body = { entityType: resolvedEntityType, mapping } as QuickBooksPushBody;
    logEvent({
      eventType: `qb_push_${resolvedEntityType.toLowerCase()}_submitted`,
      eventData: { documentId, entityType: resolvedEntityType, direction: selectedDirection },
    });
    setPushing(true);
    try {
      const result = await pushDocumentToQuickBooks(orgId, documentId, body);
      if (result.alreadyPushed) {
        toast.info(t("alreadySyncedGeneric"));
      } else {
        toast.success(
          t("pushSuccessAs", { type: t(`direction.${selectedDirection}`) })
        );
      }
      logEvent({
        eventType: "qb_push_success",
        eventData: { documentId, entityType: resolvedEntityType, direction: selectedDirection },
      });
      onPushed();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("pushFailed");
      const code =
        err instanceof Error && "code" in err ? (err as { code?: string }).code : undefined;
      if (code) {
        const errorKey = `errors.${code}` as const;
        toast.error(t(errorKey));
        logEvent({
          eventType: "qb_push_validation_error",
          eventData: { documentId, code },
        });
      } else {
        toast.error(msg);
        logEvent({
          eventType: "qb_push_error",
          eventData: { documentId, direction: selectedDirection },
        });
      }
    } finally {
      setPushing(false);
    }
  };

  const renderForm = () => {
    if (fetchError) {
      return (
        <div className="py-6 text-center space-y-3" data-testid="qb-push-form-error">
          <p className="text-sm text-destructive">{fetchError}</p>
          <p className="text-xs text-muted-foreground">{t("reconnectHint")}</p>
          <Button
            variant="outline"
            size="sm"
            data-testid="qb-push-reconnect-btn"
            onClick={async () => {
              logEvent({
                eventType: "qb_push_reconnect_clicked",
                eventData: { documentId },
              });
              try {
                const { authorizationUrl } = await startQuickBooksOAuth(orgId);
                window.open(authorizationUrl, "_blank");
              } catch {
                toast.error(t("pushFailed"));
              }
            }}
          >
            {t("reconnect")}
          </Button>
        </div>
      );
    }

    switch (resolvedEntityType) {
      case "Purchase": {
        const cachedPurchase = loadCachedMapping<QuickBooksPurchaseMapping>(orgId, "Purchase");
        const effectiveMapping = cachedPurchase ?? savedMapping;
        return (
          <QbPurchaseForm
            orgId={orgId}
            documentId={documentId}
            savedMapping={effectiveMapping}
            onReady={(m) => { currentMappingRef.current = m; }}
            onLoadError={handleLoadError}
            onLoadComplete={handleLoadComplete}
          />
        );
      }
      case "Invoice": {
        const cachedInvoice = loadCachedMapping<QbInvoiceMapping>(orgId, "Invoice");
        return (
          <QbInvoiceForm
            orgId={orgId}
            documentId={documentId}
            initialCustomerId={cachedInvoice?.customerRef?.value}
            initialItemId={cachedInvoice?.itemRef?.value}
            initialDueDate={cachedInvoice?.dueDate}
            onReady={(m) => { currentMappingRef.current = m; }}
            onLoadError={handleLoadError}
            onLoadComplete={handleLoadComplete}
          />
        );
      }
      case "Bill": {
        const cachedBill = loadCachedMapping<QbBillMapping>(orgId, "Bill");
        return (
          <QbBillForm
            orgId={orgId}
            documentId={documentId}
            initialVendorId={cachedBill?.vendorRef?.value}
            initialExpenseAccountId={cachedBill?.expenseAccountRef?.value}
            initialDueDate={cachedBill?.dueDate}
            onReady={(m) => { currentMappingRef.current = m; }}
            onLoadError={handleLoadError}
            onLoadComplete={handleLoadComplete}
          />
        );
      }
      default:
        return null;
    }
  };

  const formTitle = selectedDirection === "income"
    ? t("direction.income")
    : t("direction.expense");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="quickbooks-push-dialog"
        className="sm:max-w-[520px]"
      >
        <DialogHeader>
          <DialogTitle data-testid="quickbooks-push-dialog-title">
            {step === "pick-type"
              ? t("chooseTypeTitle")
              : formTitle}
          </DialogTitle>
        </DialogHeader>

        {step === "pick-type" ? (
          <QbTypePickerStep
            selected={selectedDirection}
            onSelect={handleDirectionSelect}
            onContinue={handleContinue}
            onCancel={onClose}
          />
        ) : (
          <>
            {renderForm()}
            <DialogFooter data-testid="quickbooks-push-dialog-footer">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={pushing}
                data-testid="qb-push-back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("back")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  logEvent({
                    eventType: "qb_push_cancelled",
                    eventData: { documentId },
                  });
                  onClose();
                }}
                disabled={pushing}
                data-testid="qb-push-cancel-btn"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={() => void handlePush()}
                disabled={pushing || !formLoaded || !!fetchError}
                data-testid="qb-push-confirm-btn"
              >
                {pushing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("pushButton")
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
