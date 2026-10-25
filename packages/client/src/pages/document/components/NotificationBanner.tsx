"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  AlertCircle,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react";
import type { DocumentNotification, NotificationStatus } from "@zdocs/types";
import { updateNotificationStatus } from "../../../utilities/api/updateNotificationStatus";
import { toast } from "sonner";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface NotificationBannerProps {
  orgId: string;
  notifications: DocumentNotification[];
  onNotificationUpdate?: () => void;
  documentId?: string;
}

export function NotificationBanner({
  orgId,
  notifications,
  onNotificationUpdate,
  documentId,
}: NotificationBannerProps) {
  const t = useTranslations("notifications");
  const { logEvent } = useLogUserJourneyEvent();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter to only warning/error with IDs (those saved to DB)
  // Note: DocumentNotification[] from document_data are always document-scoped,
  // so no need to filter by notificationType (which doesn't exist on DocumentNotification)
  const persistedNotifications = notifications.filter(
    (n) =>
      n.id &&
      (n.level === "warning" || n.level === "error") &&
      !dismissedIds.has(n.id)
  );

  if (persistedNotifications.length === 0) {
    return null;
  }

  const handleMarkAs = async (
    notificationId: string,
    status: NotificationStatus
  ) => {
    setUpdatingIds((prev) => new Set(prev).add(notificationId));

    try {
      await updateNotificationStatus(orgId, notificationId, status);

      // Dismiss from UI
      setDismissedIds((prev) => new Set(prev).add(notificationId));

      logEvent({
        eventType: "document_notification_status_changed",
        eventData: {
          documentId,
          notificationId,
          status,
        },
      });

      toast.success(
        status === "RESOLVED" ? t("markedResolved") : t("markedIgnored")
      );

      onNotificationUpdate?.();
    } catch (error) {
      console.error("Failed to update notification:", error);
      logEvent({
        eventType: "document_notification_status_change_error",
        eventData: {
          documentId,
          notificationId,
          status,
        },
      });
      toast.error(t("updateFailed"));
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-2" data-testid="notification-banner-container">
      {persistedNotifications.map((notification) => {
        const isUpdating = notification.id
          ? updatingIds.has(notification.id)
          : false;
        const LevelIcon =
          notification.level === "error" ? AlertCircle : AlertTriangle;
        const bgColor =
          notification.level === "error"
            ? "bg-red-500/10 border-red-500/30"
            : "bg-yellow-500/10 border-yellow-500/30";
        const iconColor =
          notification.level === "error" ? "text-red-500" : "text-yellow-500";

        return (
          <div
            key={notification.id || notification.message}
            className={`border rounded-lg p-3 ${bgColor}`}
            data-testid="notification-banner"
          >
            <div className="flex items-start gap-3">
              <LevelIcon
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`}
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground break-words">
                  {notification.message}
                </p>
                {notification.fieldPath && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("field")}: {notification.fieldPath}
                  </p>
                )}
              </div>

              {/* Actions Dropdown */}
              {notification.id && (
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <button
                      disabled={isUpdating}
                      className="flex items-center gap-1 px-3 py-1 text-xs rounded hover:bg-accent transition-colors disabled:opacity-50 border border-border"
                      data-testid="notification-actions-btn"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          {t("actions")}
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>

                    {/* Dropdown Menu */}
                    {!isUpdating && (
                      <div className="hidden group-hover:block absolute right-0 top-full mt-0 w-32 bg-card border border-border rounded-lg shadow-lg z-10">
                        <button
                          onClick={() =>
                            handleMarkAs(notification.id!, "RESOLVED")
                          }
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors rounded-t-lg text-green-600"
                          data-testid="notification-banner-resolve"
                        >
                          {t("resolve")}
                        </button>
                        <button
                          onClick={() =>
                            handleMarkAs(notification.id!, "IGNORED")
                          }
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors rounded-b-lg text-muted-foreground"
                          data-testid="notification-banner-ignore"
                        >
                          {t("ignore")}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      notification.id &&
                      handleMarkAs(notification.id, "IGNORED")
                    }
                    disabled={isUpdating}
                    className="p-1 rounded hover:bg-background/50 transition-colors disabled:opacity-50"
                    title={t("dismiss")}
                    data-testid="notification-banner-dismiss"
                  >
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
