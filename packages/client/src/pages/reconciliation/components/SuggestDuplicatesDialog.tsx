"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import { ScrollArea } from "@zdocs/client-component";
import { cn, formatCurrency, formatDate } from "@zdocs/util";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import useOrgStore from "../../../context-providers/orgStore";
import { toggleLineItemDuplicateApi } from "../../../utilities/api/toggleLineItemDuplicate";
import { useReconciliation } from "../context/ReconciliationContext";
import type { DuplicateGroup } from "../hooks/useSuggestedDuplicates";

interface SuggestDuplicatesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DuplicateGroup[];
}

/**
 * Dialog that shows heuristic-detected duplicate groups and lets the user
 * select which items to mark as duplicates. Similar in structure to
 * SuggestedPairsDialog.
 */
export function SuggestDuplicatesDialog({
  isOpen,
  onClose,
  groups,
}: SuggestDuplicatesDialogProps) {
  const t = useTranslations("reconciliation.suggestDuplicates");
  const { org } = useOrgStore();
  const { setEntityIsDuplicate } = useReconciliation();

  const allDuplicateEntityIds = useMemo(() => {
    const ids: Array<{ entityId: string; documentId: string }> = [];
    for (const group of groups) {
      for (const dup of group.duplicates) {
        ids.push({
          entityId: dup.ref.entityId,
          documentId: dup.ref.documentId,
        });
      }
    }
    return ids;
  }, [groups]);

  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(
    new Set()
  );
  const [isMarking, setIsMarking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedEntityIds(
        new Set(allDuplicateEntityIds.map((d) => d.entityId))
      );
    }
  }, [isOpen, allDuplicateEntityIds]);

  const handleToggle = useCallback((entityId: string) => {
    setSelectedEntityIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (selectedEntityIds.size === allDuplicateEntityIds.length) {
      setSelectedEntityIds(new Set());
    } else {
      setSelectedEntityIds(
        new Set(allDuplicateEntityIds.map((d) => d.entityId))
      );
    }
  }, [selectedEntityIds.size, allDuplicateEntityIds]);

  const handleMarkDuplicates = useCallback(async () => {
    if (!org?.id || selectedEntityIds.size === 0) return;

    setIsMarking(true);
    try {
      const selected = allDuplicateEntityIds.filter((d) =>
        selectedEntityIds.has(d.entityId)
      );

      for (const { entityId, documentId } of selected) {
        setEntityIsDuplicate(entityId, true);
      }

      await Promise.all(
        selected.map(({ entityId, documentId }) =>
          toggleLineItemDuplicateApi(org.id, documentId, entityId, true)
        )
      );

      toast.success(t("markedCount", { count: selected.length }));
      onClose();
    } catch (error) {
      console.error("Failed to mark duplicates:", error);
      toast.error(t("markFailed"));
    } finally {
      setIsMarking(false);
    }
  }, [
    org?.id,
    selectedEntityIds,
    allDuplicateEntityIds,
    setEntityIsDuplicate,
    t,
    onClose,
  ]);

  const allSelected = selectedEntityIds.size === allDuplicateEntityIds.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[95vh] max-w-[90vw] flex flex-col"
        data-testid="suggest-duplicates-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div
          className="flex items-center gap-2 py-2 border-b border-border"
          data-testid="suggest-duplicates-select-all"
        >
          <Checkbox
            id="select-all-dups"
            checked={allSelected}
            onCheckedChange={handleToggleAll}
          />
          <label
            htmlFor="select-all-dups"
            className="text-sm font-medium leading-none cursor-pointer"
          >
            {allSelected ? t("deselectAll") : t("selectAll")}
          </label>
          <span
            className={cn(
              allSelected
                ? "text-sm text-muted-foreground"
                : "font-bold text-sm"
            )}
          >
            ({t("selectedCount", {
              count: selectedEntityIds.size,
              total: allDuplicateEntityIds.length,
            })})
          </span>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="py-2 space-y-3" data-testid="suggest-duplicates-list">
            {groups.map((group, groupIndex) => (
              <div
                key={group.original.ref.entityId}
                className="border border-border rounded-lg overflow-hidden"
                data-testid={`duplicate-group-${groupIndex}`}
              >
                {/* Original item - not selectable */}
                <div
                  className="px-3 py-2 bg-muted/50 text-sm font-medium flex items-center gap-2"
                  data-testid={`duplicate-group-${groupIndex}-original`}
                >
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {t("original")}
                  </span>
                  <ItemSummary item={group.original} />
                </div>

                {/* Duplicate items - selectable */}
                {group.duplicates.map((dup) => (
                  <div
                    key={dup.ref.entityId}
                    className={cn(
                      "px-3 py-2 flex items-center gap-2 border-t border-border transition-colors",
                      selectedEntityIds.has(dup.ref.entityId)
                        ? "bg-accent/30"
                        : "bg-background"
                    )}
                    data-testid={`duplicate-item-${dup.ref.entityId}`}
                  >
                    <Checkbox
                      checked={selectedEntityIds.has(dup.ref.entityId)}
                      onCheckedChange={() => handleToggle(dup.ref.entityId)}
                    />
                    <span className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">
                      {t("duplicate")}
                    </span>
                    <ItemSummary item={dup} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isMarking}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleMarkDuplicates}
            disabled={selectedEntityIds.size === 0 || isMarking}
            className="min-w-[140px]"
            data-testid="suggest-duplicates-mark-btn"
          >
            {isMarking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("marking")}
              </>
            ) : (
              t("markSelected", { count: selectedEntityIds.size })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemSummary({ item }: { item: EntityResponse }) {
  const description =
    item.preview?.description || item.data?.description || "";
  const date = item.preview?.date;
  const amount = item.preview?.amount;
  const currency = item.preview?.currency;

  return (
    <div
      className="flex-1 flex items-center gap-3 text-sm min-w-0"
      data-testid="item-summary"
    >
      {date && (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatDate(date)}
        </span>
      )}
      <span className="truncate flex-1">{String(description)}</span>
      {amount != null && (
        <span className="font-mono whitespace-nowrap">
          {formatCurrency(amount, currency || undefined)}
        </span>
      )}
    </div>
  );
}
