"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import type {
  ReconciliationSessionOptions,
  ToleranceReconcileMapping,
} from "@zdocs/types";
import { CompactDateRangePicker } from "../../search/components/CompactDateRangePicker";
import {
  updateSavedReconciliationSessionApi,
  createSavedReconciliationSessionApi,
} from "../../../utilities/api/savedReconciliationSessions";
import { useReconciliation } from "../context/ReconciliationContext";
import { DownloadReconciliationCSV } from "./DownloadReconciliationCSV";

// True when the user has at least one manual tolerance override worth persisting.
function hasOverrides(overrides: ToleranceReconcileMapping): boolean {
  for (const sourceField in overrides) {
    if (Object.keys(overrides[sourceField] ?? {}).length > 0) return true;
  }
  return false;
}

// Debounce window before auto-persisting tolerance edits to the loaded session.
const AUTO_SAVE_OVERRIDES_DEBOUNCE_MS = 500;

export function ReconciliationFilters() {
  const {
    sourceEntity,
    sourceEntities,
    sourceEntityName,
    sourceQuery,
    sourceDateFrom,
    sourceDateTo,
    targetEntity,
    targetEntities,
    targetEntityName,
    targetQuery,
    targetDateFrom,
    targetDateTo,
    selectedSessionId,
    selectedSessionName,
    setSelectedSessionId,
    setSelectedSessionName,
    hideReconciled,
    setHideReconciled,
    hideDuplicates,
    setHideDuplicates,
    sharedDateFrom,
    setSharedDateFrom,
    sharedDateTo,
    setSharedDateTo,
    sharedDateRangeShortcut,
    setSharedDateRangeShortcut,
    setTriggerLoadDocuments,
    getSourceColumnStateRef,
    getTargetColumnStateRef,
    fieldMappingOverrides,
    setShowSidebar,
  } = useReconciliation();
  const t = useTranslations("reconciliation");
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");

  // Build the full options payload from the current context state.
  // The server replaces the JSONB `options` column wholesale, so we always
  // send a complete snapshot to avoid wiping unrelated fields.
  const buildOptionsPayload =
    useCallback((): ReconciliationSessionOptions => {
      return {
        hideReconciled,
        hideDuplicates,
        sourceEntityKeys: sourceEntities.map((entity) => entity.schemaType),
        targetEntityKeys: targetEntities.map((entity) => entity.schemaType),
        dateFrom: sharedDateFrom
          ? sharedDateFrom.toISOString().split("T")[0]
          : undefined,
        dateTo: sharedDateTo
          ? sharedDateTo.toISOString().split("T")[0]
          : undefined,
        dateRangeShortcut: sharedDateRangeShortcut ?? undefined,
        sourceColumnState: getSourceColumnStateRef.current?.() || undefined,
        targetColumnState: getTargetColumnStateRef.current?.() || undefined,
        fieldMappingOverrides: hasOverrides(fieldMappingOverrides)
          ? fieldMappingOverrides
          : undefined,
      };
    }, [
      hideReconciled,
      hideDuplicates,
      sourceEntities,
      targetEntities,
      sharedDateFrom,
      sharedDateTo,
      sharedDateRangeShortcut,
      getSourceColumnStateRef,
      getTargetColumnStateRef,
      fieldMappingOverrides,
    ]);

  const handleSaveSelectedSession = async () => {
    if (!selectedSessionId || !sourceEntity || !targetEntity) return;

    setIsSavingSession(true);
    try {
      await updateSavedReconciliationSessionApi(selectedSessionId, {
        sourceEntity,
        sourceQuery,
        sourceDateFrom,
        sourceDateTo,
        targetEntity,
        targetQuery,
        targetDateFrom,
        targetDateTo,
        options: buildOptionsPayload(),
      });
      toast.success(t("sessionUpdated"));
    } catch (error) {
      console.error("Failed to update session:", error);
      toast.error(t("updateSessionFailed"));
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleSaveNewClick = () => {
    setSessionName("");
    setSessionDescription("");
    setShowSaveDialog(true);
  };

  const handleSaveNewConfirm = async () => {
    if (!sessionName.trim()) {
      toast.error(t("sessionNameRequired"));
      return;
    }
    if (!sourceEntity || !targetEntity) return;

    setIsSavingSession(true);
    try {
      const newSession = await createSavedReconciliationSessionApi({
        name: sessionName.trim(),
        description: sessionDescription.trim() || undefined,
        sourceEntity,
        sourceQuery,
        sourceDateFrom,
        sourceDateTo,
        targetEntity,
        targetQuery,
        targetDateFrom,
        targetDateTo,
        options: buildOptionsPayload(),
      });
      setSelectedSessionId(newSession.id);
      setSelectedSessionName(newSession.name);
      setShowSaveDialog(false);
      toast.success(t("sessionSaved"));
      setShowSidebar(true);
    } catch (error) {
      console.error("Failed to save session:", error);
      toast.error(t("saveSessionFailed"));
    } finally {
      setIsSavingSession(false);
    }
  };

  const canSaveNew =
    !selectedSessionId &&
    sourceEntities.length > 0 &&
    targetEntities.length > 0;

  // Auto-persist tolerance overrides (dayDrift / amountDrift) into the loaded
  // session as soon as the user edits them. Debounced to coalesce rapid edits.
  // Skips the initial sync after a session loads so we don't write back what
  // we just read.
  const lastSavedOverridesRef = useRef<string | null>(null);

  useEffect(() => {
    // When the loaded session changes, reset the baseline to the current
    // overrides so the auto-save effect won't fire just because the value
    // shifted from the previous session's overrides.
    lastSavedOverridesRef.current = JSON.stringify(fieldMappingOverrides ?? {});
    // We intentionally do not include fieldMappingOverrides in the deps:
    // we want this baseline reset only when the *session* changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId || !sourceEntity || !targetEntity) return;

    const serialized = JSON.stringify(fieldMappingOverrides ?? {});
    if (serialized === lastSavedOverridesRef.current) return;

    const timer = setTimeout(async () => {
      try {
        await updateSavedReconciliationSessionApi(selectedSessionId, {
          sourceEntity,
          sourceQuery,
          sourceDateFrom,
          sourceDateTo,
          targetEntity,
          targetQuery,
          targetDateFrom,
          targetDateTo,
          options: buildOptionsPayload(),
        });
        lastSavedOverridesRef.current = serialized;
        toast.success("Tolerance saved", { duration: 1500 });
      } catch (error) {
        console.error("Failed to auto-save tolerance overrides:", error);
        toast.error("Failed to save tolerance");
      }
    }, AUTO_SAVE_OVERRIDES_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    fieldMappingOverrides,
    selectedSessionId,
    sourceEntity,
    targetEntity,
    sourceQuery,
    sourceDateFrom,
    sourceDateTo,
    targetQuery,
    targetDateFrom,
    targetDateTo,
    buildOptionsPayload,
  ]);

  return (
    <div className="flex items-center gap-3 ml-auto" data-testid="reconciliation-filters">
      {selectedSessionId && selectedSessionName && (
        <div
          className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1"
          data-testid="selected-session-chip"
        >
          <span className="max-w-[220px] truncate text-xs font-medium text-foreground">
            {selectedSessionName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleSaveSelectedSession}
            disabled={isSavingSession}
            data-testid="save-selected-session-btn"
            title={t("updateSession")}
          >
            {isSavingSession ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
      {canSaveNew && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={handleSaveNewClick}
          data-testid="save-new-session-btn"
        >
          <Plus className="w-3 h-3 mr-1" />
          {t("save")}
        </Button>
      )}
      <div className="flex items-center gap-1.5" data-testid="hide-reconciled-filter">
        <input
          type="checkbox"
          id="hide-reconciled"
          checked={hideReconciled}
          onChange={(e) => setHideReconciled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label
          htmlFor="hide-reconciled"
          className="text-xs font-medium leading-none cursor-pointer whitespace-nowrap"
        >
          Hide reconciled
        </label>
      </div>
      <div className="flex items-center gap-1.5" data-testid="hide-duplicates-filter">
        <input
          type="checkbox"
          id="hide-duplicates"
          checked={hideDuplicates}
          onChange={(e) => setHideDuplicates(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label
          htmlFor="hide-duplicates"
          className="text-xs font-medium leading-none cursor-pointer whitespace-nowrap"
        >
          Hide duplicate
        </label>
      </div>
      <div className="flex items-center gap-2" data-testid="date-range-filter">
        <CompactDateRangePicker
          dateFrom={sharedDateFrom}
          dateTo={sharedDateTo}
          onDateRangeChange={(from, to) => {
            setSharedDateFrom(from);
            setSharedDateTo(to);
            setTriggerLoadDocuments();
          }}
          selectedQuickRange={sharedDateRangeShortcut}
          onQuickRangeChange={(range) => {
            setSharedDateRangeShortcut(range);
          }}
        />
      </div>
      <DownloadReconciliationCSV />

      {/* Save New Session Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid="save-new-session-dialog">
          <DialogHeader>
            <DialogTitle>{t("saveSessionTitle")}</DialogTitle>
            <DialogDescription>{t("saveSessionDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4" data-testid="save-new-session-form">
            <div data-testid="session-name-field">
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder={t("sessionNamePlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveNewConfirm();
                  }
                }}
                data-testid="new-session-name-input"
              />
            </div>
            <div data-testid="session-description-field">
              <Input
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                placeholder={t("sessionDescriptionPlaceholder")}
                data-testid="new-session-description-input"
              />
            </div>
            <div
              className="text-xs text-muted-foreground space-y-1 bg-secondary/50 p-2 rounded"
              data-testid="session-preview-info"
            >
              <p className="font-medium">{t("sessionWillSave")}:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  Source entity:{" "}
                  <span className="font-mono text-xs">
                    {sourceEntities.length > 0
                      ? sourceEntities
                          .map((entity) => entity.displayName)
                          .join(", ")
                      : sourceEntityName ||
                        sourceEntity?.displayName ||
                        sourceEntity?.schemaType}
                  </span>
                </li>
                {sourceQuery && (
                  <li>
                    Source search:{" "}
                    <span className="font-mono text-xs">{sourceQuery}</span>
                  </li>
                )}
                <li>
                  Target entity:{" "}
                  <span className="font-mono text-xs">
                    {targetEntities.length > 0
                      ? targetEntities
                          .map((entity) => entity.displayName)
                          .join(", ")
                      : targetEntityName ||
                        targetEntity?.displayName ||
                        targetEntity?.schemaType}
                  </span>
                </li>
                {targetQuery && (
                  <li>
                    Target search:{" "}
                    <span className="font-mono text-xs">{targetQuery}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter data-testid="save-new-session-footer">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              data-testid="cancel-new-save-btn"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveNewConfirm}
              disabled={isSavingSession || !sessionName.trim()}
              data-testid="confirm-new-save-btn"
            >
              {isSavingSession && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

