"use client";
import { Minus, Plus, X, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useUploadStore } from "../../../context-providers/uploadStore";
import { UploadProgressItem } from "./UploadProgressItem";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

export function UploadProgressPanel() {
  const t = useTranslations("uploadProgress");
  const router = useRouter();
  const { logEvent } = useLogUserJourneyEvent();
  const {
    items,
    isExpanded,
    isPanelVisible,
    toggleExpanded,
    hidePanel,
  } = useUploadStore();

  if (!isPanelVisible || items.length === 0) {
    return null;
  }

  const uploadingCount = items.filter(
    (item) => item.status === "uploading"
  ).length;
  const processingCount = items.filter(
    (item) => item.status === "processing"
  ).length;
  const completeCount = items.filter(
    (item) => item.status === "complete" || item.status === "partial"
  ).length;
  const failedCount = items.filter((item) => item.status === "failed").length;

  const getSummaryText = () => {
    const parts: string[] = [];
    if (uploadingCount > 0) {
      parts.push(t("uploadingCount", { count: uploadingCount }));
    }
    if (processingCount > 0) {
      parts.push(t("processingCount", { count: processingCount }));
    }
    if (completeCount > 0) {
      parts.push(t("completeCount", { count: completeCount }));
    }
    if (failedCount > 0) {
      parts.push(t("failedCount", { count: failedCount }));
    }
    return parts.join(", ") || t("noUploads");
  };

  const handleView = (documentId: string) => {
    logEvent({
      eventType: "browse_upload_item_viewed",
      eventData: {
        documentId,
      },
    });
    router.push(`/document/${documentId}`);
  };

  const handleToggleExpanded = () => {
    const newState = !isExpanded;
    toggleExpanded();
    logEvent({
      eventType: newState ? "browse_upload_panel_expanded" : "browse_upload_panel_collapsed",
    });
  };

  const handleHidePanel = () => {
    hidePanel();
    logEvent({
      eventType: "browse_upload_panel_closed",
    });
  };

  return (
    <div
      className="fixed bottom-4 right-4 w-80 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
      data-testid="upload-progress-panel"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border cursor-pointer"
        onClick={handleToggleExpanded}
        data-testid="upload-progress-header"
      >
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {t("title")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpanded();
            }}
            className="p-1 hover:bg-accent rounded transition-colors"
            data-testid="upload-progress-toggle"
          >
            {isExpanded ? (
              <Minus className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Plus className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleHidePanel();
            }}
            className="p-1 hover:bg-accent rounded transition-colors"
            data-testid="upload-progress-close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded ? (
        <div
          className="max-h-64 overflow-y-auto"
          data-testid="upload-progress-list"
        >
          {items.map((item) => (
            <UploadProgressItem
              key={item.id}
              item={item}
              onView={handleView}
            />
          ))}
        </div>
      ) : (
        <div
          className="px-3 py-2 text-xs text-muted-foreground"
          data-testid="upload-progress-summary"
        >
          {getSummaryText()}
        </div>
      )}
    </div>
  );
}

