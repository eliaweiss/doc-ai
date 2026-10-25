"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, Trash2, CheckCircle2, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { toast } from "sonner";
import { formatDate } from "@zdocs/util";
import { updateQbDocument, deleteQbDocument } from "../../../utilities/api/quickbooksDocumentApi";
import type { QbDocumentStatus } from "../../../utilities/api/quickbooksDocumentApi";
import type { QbEntityType } from "@zdocs/types";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface QuickBooksManageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  documentId: string;
  qbStatus: QbDocumentStatus;
  onStatusChanged: () => void;
}

interface QbRef { name?: string; value?: string }

interface SyncDetails {
  rows: { label: string; value: string }[];
}

function extractSyncDetails(
  entityType: QbEntityType | null | undefined,
  syncData: Record<string, unknown> | null | undefined,
  t: (key: string) => string
): SyncDetails {
  const rows: { label: string; value: string }[] = [];
  if (!syncData) return { rows };

  const request = syncData.request as { mapping?: Record<string, unknown> } | undefined;
  const mapping = request?.mapping as Record<string, unknown> | undefined;
  if (!mapping) return { rows };

  const ref = (key: string): string | null => {
    const r = mapping[key] as QbRef | undefined;
    return r?.name ?? null;
  };

  switch (entityType) {
    case "Invoice": {
      const customer = ref("customerRef");
      const item = ref("itemRef");
      const taxCode = ref("taxCodeRef");
      const dueDate = mapping.dueDate as string | null | undefined;
      if (customer) rows.push({ label: t("customer"), value: customer });
      if (item) rows.push({ label: t("serviceItem"), value: item });
      if (taxCode) rows.push({ label: t("taxCode"), value: taxCode });
      if (dueDate) rows.push({ label: t("dueDate"), value: formatDate(dueDate) });
      break;
    }
    case "Bill": {
      const vendor = ref("vendorRef");
      const account = ref("expenseAccountRef");
      const dueDate = mapping.dueDate as string | null | undefined;
      if (vendor) rows.push({ label: t("vendor"), value: vendor });
      if (account) rows.push({ label: t("expenseAccount"), value: account });
      if (dueDate) rows.push({ label: t("dueDate"), value: formatDate(dueDate) });
      break;
    }
    case "Purchase": {
      const payAccount = ref("paymentAccountRef");
      const expAccount = ref("expenseAccountRef");
      const payType = mapping.paymentType as string | undefined;
      if (payAccount) rows.push({ label: t("paymentAccount"), value: payAccount });
      if (expAccount) rows.push({ label: t("expenseAccount"), value: expAccount });
      if (payType) rows.push({ label: t("paymentType"), value: payType });
      break;
    }
    default:
      break;
  }

  return { rows };
}

export function QuickBooksManageDialog({
  isOpen,
  onClose,
  orgId,
  documentId,
  qbStatus,
  onStatusChanged,
}: QuickBooksManageDialogProps) {
  const t = useTranslations("documentPage.quickbooks");
  const { logEvent } = useLogUserJourneyEvent();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      logEvent({
        eventType: "qb_manage_dialog_opened",
        eventData: { documentId, entityType: qbStatus.entityType ?? null, synced: qbStatus.synced ?? false },
      });
    }
  }, [isOpen, documentId, qbStatus.entityType, qbStatus.synced, logEvent]);

  const entityTypeLabel = qbStatus.entityType
    ? t(`entityType.${qbStatus.entityType}`)
    : null;

  const { rows: detailRows } = extractSyncDetails(qbStatus.entityType, qbStatus.syncData, t);

  const handleUpdate = async () => {
    logEvent({
      eventType: "qb_manage_update_clicked",
      eventData: { documentId, entityType: qbStatus.entityType ?? null },
    });
    setIsUpdating(true);
    try {
      await updateQbDocument(orgId, documentId);
      logEvent({
        eventType: "qb_manage_update_success",
        eventData: { documentId, entityType: qbStatus.entityType ?? null },
      });
      toast.success(t("updateSuccess"));
      onStatusChanged();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("updateFailed");
      logEvent({
        eventType: "qb_manage_update_error",
        eventData: { documentId, entityType: qbStatus.entityType ?? null, errorType: err instanceof Error ? err.name : "unknown" },
      });
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    logEvent({
      eventType: "qb_manage_delete_confirmed",
      eventData: { documentId, entityType: qbStatus.entityType ?? null },
    });
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await deleteQbDocument(orgId, documentId);
      logEvent({
        eventType: "qb_manage_delete_success",
        eventData: { documentId, entityType: qbStatus.entityType ?? null },
      });
      toast.success(t("deleteSuccess"));
      onStatusChanged();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("deleteFailed");
      logEvent({
        eventType: "qb_manage_delete_error",
        eventData: { documentId, entityType: qbStatus.entityType ?? null, errorType: err instanceof Error ? err.name : "unknown" },
      });
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const isBusy = isUpdating || isDeleting;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          logEvent({
            eventType: "qb_manage_dialog_closed",
            eventData: { documentId, entityType: qbStatus.entityType ?? null },
          });
          onClose();
        }
      }}>
        <DialogContent
          data-testid="quickbooks-manage-dialog"
          className="sm:max-w-[380px] p-0 overflow-hidden"
        >
          {/* QB branded header */}
          <div className="bg-[#072003] px-6 py-4 flex items-center gap-3" data-testid="quickbooks-manage-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/svg/qbo_ball_logo.svg" alt="QuickBooks" className="w-7 h-7 brightness-0 invert" />
            <DialogHeader className="p-0 space-y-0">
              <DialogTitle className="text-white text-base font-semibold" data-testid="quickbooks-manage-dialog-title">
                {t("manageTitle")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-4 space-y-4" data-testid="quickbooks-manage-info">
            {/* Sync status badge */}
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3" data-testid="quickbooks-manage-status-badge">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {entityTypeLabel && (
                  <p className="text-sm font-medium text-foreground" data-testid="quickbooks-manage-entity-type">
                    {t("syncedAs", { type: entityTypeLabel })}
                  </p>
                )}
              </div>
              {qbStatus.syncedAt && (
                <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="quickbooks-manage-synced-at">
                  <Calendar className="w-3 h-3" />
                  {t("syncedAt", { date: formatDate(qbStatus.syncedAt) })}
                </p>
              )}
            </div>

            {/* Entity details */}
            {detailRows.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border text-sm" data-testid="quickbooks-manage-details">
                {detailRows.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 gap-3" data-testid={`qb-detail-${label}`}>
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="text-foreground text-right font-medium truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2" data-testid="quickbooks-manage-actions">
              <Button
                variant="outline"
                onClick={() => void handleUpdate()}
                disabled={isBusy}
                data-testid="qb-manage-update-btn"
                className="w-full justify-start gap-3 h-11"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <RefreshCw className="w-4 h-4 shrink-0" />
                )}
                <span>{t("updateInQb")}</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  logEvent({
                    eventType: "qb_manage_delete_dialog_opened",
                    eventData: { documentId, entityType: qbStatus.entityType ?? null },
                  });
                  setShowDeleteConfirm(true);
                }}
                disabled={isBusy}
                data-testid="qb-manage-delete-btn"
                className="w-full justify-start gap-3 h-11 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive hover:border-destructive/50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Trash2 className="w-4 h-4 shrink-0" />
                )}
                <span>{t("deleteFromQb")}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="qb-delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="qb-delete-confirm-title">
              {t("deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="qb-delete-confirm-message">
              {t("deleteConfirmMessage", { type: entityTypeLabel ?? t("deleteConfirmFallbackType") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="qb-delete-cancel-btn">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteConfirm()}
              data-testid="qb-delete-confirm-btn"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deleteFromQb")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
