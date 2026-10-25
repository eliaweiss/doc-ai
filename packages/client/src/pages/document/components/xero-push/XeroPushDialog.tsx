"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { toast } from "sonner";
import type {
  XeroBillMapping,
  XeroEntityType,
  XeroInvoiceMapping,
  XeroPushBody,
} from "@zdocs/types";
import { pushDocumentToXero } from "../../../../utilities/api/xeroDocumentApi";
import { startXeroOAuth } from "../../../../utilities/api/xeroIntegrationApi";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";
import { XeroTypePickerStep, type XeroDirection } from "./XeroTypePickerStep";
import { XeroInvoiceForm } from "./forms/XeroInvoiceForm";
import { XeroBillForm } from "./forms/XeroBillForm";

type Step = "pick-type" | "form";

function directionToEntityType(direction: XeroDirection): XeroEntityType {
  return direction === "income" ? "Invoice" : "Bill";
}

function storageKey(orgId: string, entityType: XeroEntityType) {
  return `xero-push:${orgId}:${entityType}`;
}

function directionStorageKey(orgId: string) {
  return `xero-push:${orgId}:direction`;
}

function loadCachedMapping<T>(orgId: string, entityType: XeroEntityType): T | null {
  try {
    const raw = localStorage.getItem(storageKey(orgId, entityType));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function loadCachedDirection(orgId: string): XeroDirection | null {
  try {
    const raw = localStorage.getItem(directionStorageKey(orgId));
    return raw === "income" || raw === "expense" ? raw : null;
  } catch {
    return null;
  }
}

function saveCachedDirection(orgId: string, direction: XeroDirection) {
  try {
    localStorage.setItem(directionStorageKey(orgId), direction);
  } catch {
    /* ignore */
  }
}

function preselectedDirection(docType: string | null | undefined): XeroDirection {
  if (docType === "INVOICE") return "expense";
  return "expense";
}

interface XeroPushDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  documentId: string;
  docType: string | null | undefined;
  onPushed: () => void;
}

export function XeroPushDialog({
  isOpen,
  onClose,
  orgId,
  documentId,
  docType,
  onPushed,
}: XeroPushDialogProps) {
  const t = useTranslations("documentPage.xero");
  const { logEvent } = useLogUserJourneyEvent();
  const [step, setStep] = useState<Step>("pick-type");
  const [selectedDirection, setSelectedDirection] =
    useState<XeroDirection>("expense");
  const [pushing, setPushing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formLoaded, setFormLoaded] = useState(false);
  const currentMappingRef = useRef<XeroPushBody["mapping"] | null>(null);
  const resolvedEntityType = directionToEntityType(selectedDirection);

  useEffect(() => {
    if (isOpen) {
      setStep("pick-type");
      setSelectedDirection(loadCachedDirection(orgId) ?? preselectedDirection(docType));
      setFetchError(null);
      setFormLoaded(false);
      currentMappingRef.current = null;
      logEvent({
        eventType: "xero_push_type_picker_opened",
        eventData: { documentId },
      });
    }
  }, [isOpen, documentId, orgId, logEvent]);

  const handleDirectionSelect = useCallback(
    (direction: XeroDirection) => {
      setSelectedDirection(direction);
      saveCachedDirection(orgId, direction);
      logEvent({
        eventType: "xero_push_type_selected",
        eventData: { documentId, direction },
      });
    },
    [documentId, orgId, logEvent]
  );

  const handleContinue = useCallback(() => {
    setStep("form");
    setFetchError(null);
    setFormLoaded(false);
    currentMappingRef.current = null;
  }, []);

  const handleBack = useCallback(() => {
    logEvent({
      eventType: "xero_push_back_to_type_picker",
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
        eventType: "xero_push_data_load_error",
        eventData: { documentId, direction: selectedDirection },
      });
    },
    [documentId, logEvent, selectedDirection]
  );

  const handleLoadComplete = useCallback(() => {
    setFormLoaded(true);
    logEvent({
      eventType: `xero_push_${resolvedEntityType.toLowerCase()}_data_loaded`,
      eventData: { documentId, entityType: resolvedEntityType },
    });
  }, [documentId, logEvent, resolvedEntityType]);

  const handlePush = async () => {
    const mapping = currentMappingRef.current;
    if (!mapping) return;
    const body = { entityType: resolvedEntityType, mapping } as XeroPushBody;
    setPushing(true);
    try {
      const result = await pushDocumentToXero(orgId, documentId, body);
      toast.success(
        result.alreadyPushed
          ? t("alreadySyncedGeneric")
          : t("pushSuccessAs", { type: t(`entityType.${resolvedEntityType}`) })
      );
      logEvent({
        eventType: "xero_push_success",
        eventData: { documentId, entityType: resolvedEntityType },
      });
      onPushed();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("pushFailed");
      toast.error(msg);
      logEvent({
        eventType: "xero_push_error",
        eventData: { documentId, entityType: resolvedEntityType },
      });
    } finally {
      setPushing(false);
    }
  };

  const renderForm = () => {
    if (fetchError) {
      return (
        <div className="py-6 text-center space-y-3" data-testid="xero-push-form-error">
          <p className="text-sm text-destructive">{fetchError}</p>
          <p className="text-xs text-muted-foreground">{t("reconnectHint")}</p>
          <Button
            variant="outline"
            size="sm"
            data-testid="xero-push-reconnect-btn"
            onClick={async () => {
              try {
                const { authorizationUrl } = await startXeroOAuth(orgId);
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

    if (resolvedEntityType === "Invoice") {
      const cached = loadCachedMapping<XeroInvoiceMapping>(orgId, "Invoice");
      return (
        <XeroInvoiceForm
          orgId={orgId}
          documentId={documentId}
          initialContactId={cached?.contactRef?.value}
          initialAccountCode={cached?.accountRef?.value}
          initialTaxType={cached?.taxTypeRef?.value}
          initialDueDate={cached?.dueDate}
          onReady={(mapping) => {
            currentMappingRef.current = mapping;
          }}
          onLoadError={handleLoadError}
          onLoadComplete={handleLoadComplete}
        />
      );
    }

    const cached = loadCachedMapping<XeroBillMapping>(orgId, "Bill");
    return (
      <XeroBillForm
        orgId={orgId}
        documentId={documentId}
        initialContactId={cached?.contactRef?.value}
        initialExpenseAccountCode={cached?.expenseAccountRef?.value}
        initialTaxType={cached?.taxTypeRef?.value}
        initialDueDate={cached?.dueDate}
        onReady={(mapping) => {
          currentMappingRef.current = mapping;
        }}
        onLoadError={handleLoadError}
        onLoadComplete={handleLoadComplete}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="xero-push-dialog" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle data-testid="xero-push-dialog-title">
            {step === "pick-type"
              ? t("chooseTypeTitle")
              : t(`entityType.${resolvedEntityType}`)}
          </DialogTitle>
        </DialogHeader>

        {step === "pick-type" ? (
          <XeroTypePickerStep
            selected={selectedDirection}
            onSelect={handleDirectionSelect}
            onContinue={handleContinue}
            onCancel={onClose}
          />
        ) : (
          <>
            {renderForm()}
            <DialogFooter data-testid="xero-push-dialog-footer">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={pushing}
                data-testid="xero-push-back-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("back")}
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                disabled={pushing}
                data-testid="xero-push-cancel-btn"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={() => void handlePush()}
                disabled={pushing || !formLoaded || !!fetchError}
                data-testid="xero-push-confirm-btn"
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
