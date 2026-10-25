"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Plus, Trash2, Loader2, Save } from "lucide-react";
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
import { toast } from "sonner";
import {
  listSavedReconciliationSessionsApi,
  createSavedReconciliationSessionApi,
  deleteSavedReconciliationSessionApi,
  updateSavedReconciliationSessionApi,
} from "../../../utilities/api/savedReconciliationSessions";
import type {
  SavedReconciliationSession,
  ToleranceReconcileMapping,
} from "@zdocs/types";
import { useReconciliation } from "../context/ReconciliationContext";

// True when the user has at least one manual tolerance override worth persisting.
function hasOverrides(overrides: ToleranceReconcileMapping): boolean {
  for (const sourceField in overrides) {
    if (Object.keys(overrides[sourceField] ?? {}).length > 0) return true;
  }
  return false;
}

export function SavedReconciliationSessionsSidebar() {
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
    handleSessionSelect: onSessionSelect,
    setShowSidebar,
    hideReconciled,
    hideDuplicates,
    sharedDateFrom,
    sharedDateTo,
    sharedDateRangeShortcut,
    getSourceColumnStateRef,
    getTargetColumnStateRef,
    fieldMappingOverrides,
  } = useReconciliation();

  const t = useTranslations("reconciliation");
  const [savedSessions, setSavedSessions] = useState<
    SavedReconciliationSession[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [deleteSession, setDeleteSession] =
    useState<SavedReconciliationSession | null>(null);

  // Load saved sessions on mount
  useEffect(() => {
    loadSavedSessions();
  }, []);

  const loadSavedSessions = async () => {
    setIsLoading(true);
    try {
      const sessions = await listSavedReconciliationSessionsApi();
      setSavedSessions(sessions);
    } catch (error) {
      console.error("Failed to load saved sessions:", error);
      toast.error(t("loadSessionsFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (!hasValidState()) {
      toast.error(t("enterSessionDataFirst"));
      return;
    }
    setSessionName("");
    setSessionDescription("");
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = async () => {
    if (!sessionName.trim()) {
      toast.error(t("sessionNameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      if (!sourceEntity || !targetEntity) {
        toast.error(t("selectEntitiesFirst"));
        return;
      }

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
        options: {
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
        },
      });
      setSavedSessions((prev) => [newSession, ...prev]);
      setShowSaveDialog(false);
      toast.success(t("sessionSaved"));
    } catch (error) {
      console.error("Failed to save session:", error);
      toast.error(t("saveSessionFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSession) return;

    try {
      await deleteSavedReconciliationSessionApi(deleteSession.id);
      setSavedSessions((prev) => prev.filter((s) => s.id !== deleteSession.id));
      toast.success(t("sessionDeleted"));
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error(t("deleteSessionFailed"));
    } finally {
      setDeleteSession(null);
    }
  };

  const handleSessionClick = (session: SavedReconciliationSession) => {
    onSessionSelect(session.id, session);
    setShowSidebar(false);
  };

  const handleUpdateSession = async (sessionId: string) => {
    setIsUpdating(sessionId);
    try {
      if (!sourceEntity || !targetEntity) {
        toast.error(t("selectEntitiesFirst"));
        return;
      }

      const updatedSession = await updateSavedReconciliationSessionApi(
        sessionId,
        {
          sourceEntity,
          sourceQuery,
          sourceDateFrom,
          sourceDateTo,
          targetEntity,
          targetQuery,
          targetDateFrom,
          targetDateTo,
          options: {
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
          },
        }
      );
      setSavedSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updatedSession : s))
      );
      toast.success(t("sessionUpdated"));
    } catch (error) {
      console.error("Failed to update session:", error);
      toast.error(t("updateSessionFailed"));
    } finally {
      setIsUpdating(null);
    }
  };

  const hasValidState = () => {
    return sourceEntities.length > 0 && targetEntities.length > 0;
  };

  const canSave = hasValidState();

  return (
    <div
      className="flex flex-col h-full"
      data-testid="saved-reconciliation-sessions-sidebar"
    >
      {/* Header with Save button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          {t("savedSessions")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          disabled={!canSave}
          className="text-xs"
          onClick={handleSaveClick}
          data-testid="save-session-btn"
          title={!canSave ? t("enterSessionDataFirst") : undefined}
        >
          <Plus className="w-3 h-3 mr-1" />
          {t("new")}
        </Button>
      </div>

      {/* Saved Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div
            className="flex items-center justify-center py-8"
            data-testid="loading-sessions"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : savedSessions.length === 0 ? (
          <div
            className="text-sm text-muted-foreground text-center py-8"
            data-testid="no-saved-sessions"
          >
            <Bookmark className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>{t("noSavedSessions")}</p>
            <p className="text-xs mt-1">{t("noSavedSessionsHint")}</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {savedSessions.map((session) => {
              const isSelected = selectedSessionId === session.id;
              return (
                <li key={session.id} className="group relative">
                  <button
                    onClick={() => handleSessionClick(session)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 pr-16 ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent"
                    }`}
                    data-testid={`saved-session-${session.id}`}
                  >
                    <Bookmark
                      className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <div className="overflow-hidden flex-1">
                      <span
                        className={`truncate block ${
                          isSelected
                            ? "text-primary font-medium"
                            : "text-foreground"
                        }`}
                      >
                        {session.name}
                      </span>
                    </div>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateSession(session.id);
                        }}
                        disabled={isUpdating === session.id}
                        className="p-1 hover:bg-primary/10 rounded transition-all"
                        title={t("updateSession")}
                        data-testid={`update-session-${session.id}`}
                      >
                        {isUpdating === session.id ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteSession(session);
                      }}
                      className="p-1 hover:bg-destructive/10 rounded transition-all"
                      data-testid={`delete-session-${session.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Save Session Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid="save-session-dialog">
          <DialogHeader>
            <DialogTitle>{t("saveSessionTitle")}</DialogTitle>
            <DialogDescription>{t("saveSessionDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder={t("sessionNamePlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveConfirm();
                  }
                }}
                data-testid="session-name-input"
              />
            </div>
            <div>
              <Input
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                placeholder={t("sessionDescriptionPlaceholder")}
                data-testid="session-description-input"
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1 bg-secondary/50 p-2 rounded">
              <p className="font-medium">{t("sessionWillSave")}:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  Source entity:{" "}
                  <span className="font-mono text-xs">
                    {sourceEntities.length > 0
                      ? sourceEntities.map((entity) => entity.displayName).join(", ")
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
                      ? targetEntities.map((entity) => entity.displayName).join(", ")
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              data-testid="cancel-save-btn"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveConfirm}
              disabled={isSaving || !sessionName.trim()}
              data-testid="confirm-save-btn"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteSession}
        onOpenChange={(open) => !open && setDeleteSession(null)}
      >
        <AlertDialogContent data-testid="delete-session-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSessionTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteSessionConfirmation", { name: deleteSession?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-btn"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
