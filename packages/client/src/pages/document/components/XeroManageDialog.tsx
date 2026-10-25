"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { formatDate } from "@zdocs/util";
import { toast } from "sonner";
import type { XeroDocumentStatus } from "../../../utilities/api/xeroDocumentApi";
import {
  deleteXeroDocument,
  updateXeroDocument,
} from "../../../utilities/api/xeroDocumentApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface XeroManageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  documentId: string;
  xeroStatus: XeroDocumentStatus;
  onStatusChanged: () => void;
}

interface XeroRef {
  name?: string;
  value?: string;
}

function extractSyncDetails(
  syncData: Record<string, unknown> | null | undefined,
  t: (key: string) => string
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const request = syncData?.request as { mapping?: Record<string, unknown> } | undefined;
  const mapping = request?.mapping;
  if (!mapping) return rows;

  const ref = (key: string): string | null => {
    const value = mapping[key] as XeroRef | undefined;
    return value?.name ?? null;
  };

  const contact = ref("contactRef");
  const account = ref("accountRef") ?? ref("expenseAccountRef");
  const taxRate = ref("taxTypeRef");
  const dueDate = mapping.dueDate as string | null | undefined;

  if (contact) rows.push({ label: t("contact"), value: contact });
  if (account) rows.push({ label: t("account"), value: account });
  if (taxRate) rows.push({ label: t("taxRate"), value: taxRate });
  if (dueDate) rows.push({ label: t("dueDate"), value: formatDate(dueDate) });

  return rows;
}

export function XeroManageDialog({
  isOpen,
  onClose,
  orgId,
  documentId,
  xeroStatus,
  onStatusChanged,
}: XeroManageDialogProps) {
  const t = useTranslations("documentPage.xero");
  const { logEvent } = useLogUserJourneyEvent();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      logEvent({
        eventType: "xero_manage_dialog_opened",
        eventData: { documentId, entityType: xeroStatus.entityType ?? null },
      });
    }
  }, [documentId, isOpen, logEvent, xeroStatus.entityType]);

  const detailRows = extractSyncDetails(xeroStatus.syncData, t);
  const isBusy = isUpdating || isDeleting;

  const handleUpdate = async () => {
    logEvent({
      eventType: "xero_manage_update_clicked",
      eventData: { documentId, entityType: xeroStatus.entityType ?? null },
    });
    setIsUpdating(true);
    try {
      await updateXeroDocument(orgId, documentId);
      logEvent({
        eventType: "xero_manage_update_success",
        eventData: { documentId, entityType: xeroStatus.entityType ?? null },
      });
      toast.success(t("updateSuccess"));
      onStatusChanged();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("updateFailed");
      logEvent({
        eventType: "xero_manage_update_error",
        eventData: { documentId, entityType: xeroStatus.entityType ?? null, errorType: err instanceof Error ? err.name : "unknown" },
      });
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    logEvent({
      eventType: "xero_manage_delete_confirmed",
      eventData: { documentId, entityType: xeroStatus.entityType ?? null },
    });
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await deleteXeroDocument(orgId, documentId);
      logEvent({
        eventType: "xero_manage_delete_success",
        eventData: { documentId, entityType: xeroStatus.entityType ?? null },
      });
      toast.success(t("deleteSuccess"));
      onStatusChanged();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("deleteFailed");
      logEvent({
        eventType: "xero_manage_delete_error",
        eventData: { documentId, entityType: xeroStatus.entityType ?? null, errorType: err instanceof Error ? err.name : "unknown" },
      });
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          logEvent({
            eventType: "xero_manage_dialog_closed",
            eventData: { documentId, entityType: xeroStatus.entityType ?? null },
          });
          onClose();
        }
      }}>
        <DialogContent data-testid="xero-manage-dialog" className="sm:max-w-[380px]">
          <DialogHeader>
            <div className="flex items-center gap-3" data-testid="xero-manage-title-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/svg/xero_logo.webp" alt="Xero" className="w-7 h-7" />
              <DialogTitle data-testid="xero-manage-dialog-title">
                {t("manageTitle")}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4" data-testid="xero-manage-info">
            <div
              className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3"
              data-testid="xero-manage-status-badge"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {xeroStatus.entityType && (
                  <p className="text-sm font-medium text-foreground" data-testid="xero-manage-entity-type">
                    {t("syncedAs", {
                      type: t(`entityType.${xeroStatus.entityType}`),
                    })}
                  </p>
                )}
              </div>
              {xeroStatus.syncedAt && (
                <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="xero-manage-synced-at">
                  <Calendar className="w-3 h-3" />
                  {t("syncedAt", { date: formatDate(xeroStatus.syncedAt) })}
                </p>
              )}
            </div>

            {detailRows.length > 0 && (
              <div
                className="rounded-lg border border-border divide-y divide-border text-sm"
                data-testid="xero-manage-details"
              >
                {detailRows.map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-3 py-2 gap-3"
                    data-testid={`xero-detail-${label}`}
                  >
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="text-foreground text-right font-medium truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2" data-testid="xero-manage-actions">
              <Button
                variant="outline"
                onClick={() => void handleUpdate()}
                disabled={isBusy}
                data-testid="xero-manage-update-btn"
                className="w-full justify-start gap-3 h-11"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <RefreshCw className="w-4 h-4 shrink-0" />
                )}
                <span>{t("updateInXero")}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  logEvent({
                    eventType: "xero_manage_delete_dialog_opened",
                    eventData: { documentId, entityType: xeroStatus.entityType ?? null },
                  });
                  setShowDeleteConfirm(true);
                }}
                disabled={isBusy}
                data-testid="xero-manage-delete-btn"
                className="w-full justify-start gap-3 h-11 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive hover:border-destructive/50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Trash2 className="w-4 h-4 shrink-0" />
                )}
                <span>{t("deleteFromXero")}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="xero-delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="xero-delete-confirm-title">
              {t("deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="xero-delete-confirm-description">
              {t("deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="xero-delete-confirm-cancel">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteConfirm()}
              data-testid="xero-delete-confirm-action"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
