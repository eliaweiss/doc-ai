"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Bell, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import type { NotificationRecord } from "@zdocs/types";
import { fetchNotifications } from "../../utilities/api/fetchNotifications";
import { updateNotificationStatus } from "../../utilities/api/updateNotificationStatus";
import useOrgStore from "../../context-providers/orgStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const { org } = useOrgStore();
  const router = useRouter();
  const { logEvent } = useLogUserJourneyEvent();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load notifications
  useEffect(() => {
    if (!org?.id) return;

    const loadNotifications = async () => {
      // Skip if tab is not in focus
      if (document.hidden) return;

      try {
        const data = await fetchNotifications(org.id);
        setNotifications(data);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      }
    };

    loadNotifications();

    // Poll every 5 minutes
    const interval = setInterval(loadNotifications, 300000);

    // Also refresh when tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [org?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkAs = async (
    notificationId: string,
    status: "RESOLVED" | "IGNORED"
  ) => {
    if (!org?.id) return;

    setUpdatingIds((prev) => new Set(prev).add(notificationId));

    try {
      await updateNotificationStatus(org.id, notificationId, status);

      logEvent({
        eventType: "browse_header_notification_marked",
        eventData: {
          notificationId,
          status,
        },
      });

      // Remove from list
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      toast.success(
        status === "RESOLVED" ? t("markedResolved") : t("markedIgnored")
      );
    } catch (error) {
      console.error("Failed to update notification:", error);
      toast.error(t("updateFailed"));
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleNotificationClick = (notification: NotificationRecord) => {
    logEvent({
      eventType: "browse_header_notification_clicked",
      eventData: {
        notificationId: notification.id,
        notificationType: notification.notificationType,
        level: notification.level,
      },
    });
    // Route based on notification type
    if (notification.notificationType === "DOCUMENT" && notification.documentId) {
      router.push(`/document/${notification.documentId}`);
    } else if (notification.notificationType === "TASK" && notification.metadata?.taskId) {
      // Route to task page if taskId is in metadata
      router.push(`/tasks/${notification.metadata.taskId}`);
    }
    // If no valid route, just close the dropdown
    setIsOpen(false);
  };

  const count = notifications.length;
  const showBadge = count > 0;

  return (
    <div className="relative" ref={dropdownRef} data-testid="notification-bell">
      {/* Bell Icon Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            logEvent({
              eventType: "browse_header_notification_opened",
              eventData: {
                notificationCount: notifications.length,
              },
            });
          }
        }}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        data-testid="notification-bell-button"
        aria-label={t("notifications")}
      >
        <Bell className="w-5 h-5 text-foreground" />
        {showBadge && (
          <span
            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
            data-testid="notification-badge"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-card border border-border rounded-lg shadow-lg z-50 max-h-[calc(100vh-8rem)] sm:max-h-[500px] flex flex-col"
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">
              {t("notifications")}
            </h3>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bell className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">{t("noNotifications")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const isUpdating = updatingIds.has(notification.id);
                  const LevelIcon =
                    notification.level === "error" ? AlertCircle : AlertTriangle;

                  return (
                    <div
                      key={notification.id}
                      className="p-4 hover:bg-accent/50 transition-colors"
                      data-testid="notification-item"
                    >
                      <div className="flex items-start gap-3">
                        <LevelIcon
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${notification.level === "error"
                            ? "text-red-500"
                            : "text-yellow-500"
                            }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground break-words">
                            {notification.message}
                          </p>
                          {notification.fieldPath && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {notification.fieldPath}
                            </p>
                          )}
                          {notification.notificationType === "DOCUMENT" && notification.documentId && (
                            <button
                              onClick={() => handleNotificationClick(notification)}
                              className="text-xs text-primary hover:underline mt-1"
                              data-testid="notification-view-document"
                            >
                              {t("viewDocument")}
                            </button>
                          )}
                          {notification.notificationType === "TASK" && !!notification.metadata?.taskId && (
                            <button
                              onClick={() => handleNotificationClick(notification)}
                              className="text-xs text-primary hover:underline mt-1"
                              data-testid="notification-view-task"
                            >
                              {t("viewTask")}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleMarkAs(notification.id, "RESOLVED")}
                          disabled={isUpdating}
                          className="text-xs px-3 py-1 rounded bg-green-500/10 text-green-600 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                          data-testid="notification-resolve"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : (
                            t("resolve")
                          )}
                        </button>
                        <button
                          onClick={() => handleMarkAs(notification.id, "IGNORED")}
                          disabled={isUpdating}
                          className="text-xs px-3 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
                          data-testid="notification-ignore"
                        >
                          {t("ignore")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

