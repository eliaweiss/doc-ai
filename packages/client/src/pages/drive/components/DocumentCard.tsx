"use client";
import { formatCurrency, formatDate, cn } from "@zdocs/util";
import { FileText, Calendar, Activity, Table } from "lucide-react";
import { useTranslations } from "next-intl";
import { Document } from "@zdocs/types";

interface DocumentCardProps {
  document: Document;
  isSelected: boolean;
  getDocumentTypeLabel: (type: string | null) => string;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: (event: React.DragEvent) => void;
}

export function DocumentCard({
  document,
  isSelected,
  getDocumentTypeLabel,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
}: DocumentCardProps) {
  const t = useTranslations("drive");
  const text = document.description || document.fileName || "Untitled";
  const isDataset = false; // Dataset pipeline disabled
  const formattedDate = formatDate(document.documentDate || null);
  const metadata = document.metadata as Record<string, any> | null;
  const amount = metadata?.totalAmount;
  const currency = document.currency || "USD";
  const status = document.extractionStatus;
  const docTypeLabel = getDocumentTypeLabel(document.docType);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        "p-4 bg-card border rounded-lg cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border hover:border-primary/50 hover:shadow-sm"
      )}
      data-testid={`document-card-${document.id}`}
    >
      {/* Header with icon and title */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isDataset ? (
            <Table className="w-5 h-5 text-primary flex-shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-foreground truncate">
            {text}
          </span>
          {isDataset && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
              DATASET
            </span>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>{formattedDate}</span>
        </div>

        {docTypeLabel && (
          <div className="text-xs text-muted-foreground">
            {t("type")}: {docTypeLabel}
          </div>
        )}

        {status && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3 h-3" />
            <span className="capitalize">{status.toLowerCase()}</span>
          </div>
        )}

        {amount !== undefined && amount !== null && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Amount</span>
            <span className="text-sm font-mono font-medium">
              {formatCurrency(Number(amount), currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
