"use client";
import { X, ExternalLink, RotateCcw, FileText, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { UploadItem, useUploadStore } from "../../../context-providers/uploadStore";
import { cn } from "../../../lib/utils";

interface UploadProgressItemProps {
  item: UploadItem;
  onView?: (documentId: string) => void;
  onRetry?: (item: UploadItem) => void;
}

export function UploadProgressItem({ item, onView, onRetry }: UploadProgressItemProps) {
  const t = useTranslations("uploadProgress");
  const { removeItem } = useUploadStore();

  // Calculate combined progress: upload is 0-50%, extraction is 50-100%
  const calculateProgress = () => {
    if (item.status === "complete") return 100;
    if (item.status === "failed") return 0;
    
    const uploadContribution = (item.uploadProgress / 100) * 50;
    const extractionContribution = (item.extractionProgress / 100) * 50;
    return Math.round(uploadContribution + extractionContribution);
  };

  const progress = calculateProgress();

  const getStatusText = () => {
    switch (item.status) {
      case "queued":
        return t("waiting");
      case "uploading":
        return t("uploading", { percent: item.uploadProgress });
      case "processing":
        return item.extractionProgress > 0
          ? t("extracting", { percent: item.extractionProgress })
          : t("processing");
      case "complete":
        return t("readyToView");
      case "partial":
        return t("partialExtraction");
      case "failed":
        return item.error || t("failed");
      default:
        return "";
    }
  };

  const getStatusIcon = () => {
    switch (item.status) {
      case "queued":
        return <Loader2 className="w-4 h-4 text-muted-foreground animate-pulse" />;
      case "uploading":
      case "processing":
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case "complete":
        return <Check className="w-4 h-4 text-green-500" />;
      case "partial":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "failed":
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getProgressBarColor = () => {
    switch (item.status) {
      case "complete":
        return "bg-green-500";
      case "partial":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-primary";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleView = () => {
    if (item.documentId && onView) {
      onView(item.documentId);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(item);
    }
  };

  const handleDismiss = () => {
    removeItem(item.id);
  };

  const isComplete = item.status === "complete" || item.status === "partial";
  const isFailed = item.status === "failed";

  return (
    <div
      className="px-3 py-2 border-b border-border last:border-b-0"
      data-testid={`upload-progress-item-${item.id}`}
    >
      {/* File info row */}
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span
          className="text-sm font-medium text-foreground truncate flex-1"
          title={item.fileName}
        >
          {item.fileName}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatFileSize(item.fileSize)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
        <div
          className={cn(
            "h-full transition-all duration-300",
            getProgressBarColor()
          )}
          style={{ width: `${progress}%` }}
          data-testid={`upload-progress-bar-${item.id}`}
        />
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}
          <span
            className={cn(
              "text-xs",
              item.status === "failed" ? "text-red-500" : "text-muted-foreground"
            )}
          >
            {getStatusText()}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {isComplete && item.documentId && (
            <button
              onClick={handleView}
              className="p-1 hover:bg-accent rounded transition-colors"
              title={t("view")}
              data-testid={`upload-view-btn-${item.id}`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          {isFailed && onRetry && (
            <button
              onClick={handleRetry}
              className="p-1 hover:bg-accent rounded transition-colors"
              title={t("retry")}
              data-testid={`upload-retry-btn-${item.id}`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-accent rounded transition-colors"
            title={t("dismiss")}
            data-testid={`upload-dismiss-btn-${item.id}`}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

