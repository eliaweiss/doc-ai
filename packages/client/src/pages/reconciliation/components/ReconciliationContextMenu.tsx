"use client";

import { ExternalLink, ArrowRightLeft, Copy, CopyX } from "lucide-react";
import { ContextMenu } from "@zdocs/client-component";
import { useTranslations } from "next-intl";

interface ReconciliationContextMenuProps {
  /** X position for the menu */
  x: number;
  /** Y position for the menu */
  y: number;
  /** Document ID to open in new tab */
  documentId: string;
  /** Whether this item is reconciled (shows "Align with linked" option) */
  isReconciled: boolean;
  /** Whether this item is currently marked as duplicate */
  isDuplicate: boolean;
  /** Whether this is a line item (only line items can be marked as duplicate) */
  isLineItem: boolean;
  /** Handler to close the context menu */
  onClose: () => void;
  /** Handler for "Align with linked" action */
  onAlignWithLinked: () => void;
  /** Handler to toggle the duplicate flag */
  onToggleDuplicate: () => void;
}

/**
 * Shared context menu component for reconciliation panes.
 *
 * Provides:
 * - "Open in New Tab" - Opens the document in a new browser tab
 * - "Align with linked" - Shows when item is reconciled, aligns both panes
 * - "Mark/Unmark as Duplicate" - Toggles the user-set duplicate flag (line items only)
 */
export function ReconciliationContextMenu({
  x,
  y,
  documentId,
  isReconciled,
  isDuplicate,
  isLineItem,
  onClose,
  onAlignWithLinked,
  onToggleDuplicate,
}: ReconciliationContextMenuProps) {
  const t = useTranslations();
  const tReconciliation = useTranslations("reconciliation");

  const handleOpenInNewTab = () => {
    if (documentId) {
      window.open(`/document/${documentId}`, "_blank");
    }
    onClose();
  };

  const handleAlignClick = () => {
    onAlignWithLinked();
    onClose();
  };

  const handleToggleDuplicateClick = () => {
    onToggleDuplicate();
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <button
        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
        onClick={handleOpenInNewTab}
        data-testid="reconciliation-context-open-new-tab"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        {t("openInNewTab")}
      </button>
      {isReconciled && (
        <button
          className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
          onClick={handleAlignClick}
          data-testid="reconciliation-context-align-linked"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          {tReconciliation("alignWithLinked")}
        </button>
      )}
      {isLineItem && (
        <button
          className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
          onClick={handleToggleDuplicateClick}
          data-testid="reconciliation-context-toggle-duplicate"
        >
          {isDuplicate ? (
            <>
              <CopyX className="w-4 h-4 mr-2" />
              {tReconciliation("unmarkDuplicate")}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {tReconciliation("markAsDuplicate")}
            </>
          )}
        </button>
      )}
    </ContextMenu>
  );
}
