"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
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
  listSavedLedgerTraceSessionsApi,
  createSavedLedgerTraceSessionApi,
  deleteSavedLedgerTraceSessionApi,
  updateSavedLedgerTraceSessionApi,
} from "../../../utilities/api/savedLedgerTraceSessions";
import type { SavedLedgerTraceSession } from "@zdocs/types";
import { useLedgerTrace } from "../context/LedgerTraceContext";

export function SavedLedgerTraceSessionsSidebar() {
  const {
    dateFrom,
    dateTo,
    dateRangeShortcut,
    maxDepth,
    limit,
    startSchemaTypes,
    endSchemaTypes,
    selectedSessionId,
    handleSessionSelect,
  } = useLedgerTrace();

  const t = useTranslations("reconciliation.ledger.sessions");
  
  const [savedSessions, setSavedSessions] = useState<SavedLedgerTraceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [deleteSession, setDeleteSession] = useState<SavedLedgerTraceSession | null>(null);
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);

  // Load saved sessions on mount
  useEffect(() => {
    loadSavedSessions();
  }, []);

  const loadSavedSessions = async () => {
    setIsLoading(true);
    try {
      const sessions = await listSavedLedgerTraceSessionsApi();
      setSavedSessions(sessions);
    } catch (error) {
      console.error("Failed to load saved sessions:", error);
      toast.error(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClick = () => {
    setSessionName("");
    setSessionDescription("");
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = async () => {
    if (!sessionName.trim()) {
      toast.error(t("nameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const newSession = await createSavedLedgerTraceSessionApi({
        name: sessionName.trim(),
        description: sessionDescription.trim() || undefined,
        options: {
          startSchemaTypes,
          endSchemaTypes,
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
          dateRangeShortcut: dateRangeShortcut ?? undefined,
          maxDepth,
          limit,
        },
      });
      setSavedSessions((prev) => [newSession, ...prev]);
      setShowSaveDialog(false);
      toast.success(t("saved"));
    } catch (error) {
      console.error("Failed to save session:", error);
      toast.error(t("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSession) return;

    try {
      await deleteSavedLedgerTraceSessionApi(deleteSession.id);
      setSavedSessions((prev) => prev.filter((s) => s.id !== deleteSession.id));
      toast.success(t("deleted"));
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error(t("deleteFailed"));
    } finally {
      setDeleteSession(null);
    }
  };

  const handleUpdateSession = async (session: SavedLedgerTraceSession) => {
    setUpdatingSessionId(session.id);
    try {
      const updatedSession = await updateSavedLedgerTraceSessionApi(session.id, {
        options: {
          startSchemaTypes,
          endSchemaTypes,
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString(),
          dateRangeShortcut: dateRangeShortcut ?? undefined,
          maxDepth,
          limit,
        },
      });
      setSavedSessions((prev) =>
        prev.map((s) => (s.id === session.id ? updatedSession : s))
      );
      toast.success(t("updated"));
    } catch (error) {
      console.error("Failed to update session:", error);
      toast.error(t("updateFailed"));
    } finally {
      setUpdatingSessionId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="p-4 border-b">
        <Button
          onClick={handleSaveClick}
          className="w-full justify-start gap-2"
          variant="outline"
          size="sm"
          data-testid="save-ledger-session-btn"
        >
          <Plus className="w-4 h-4" />
          {t("saveCurrent")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : savedSessions.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground text-sm">
            {t("noSessions")}
          </div>
        ) : (
          <div className="space-y-1">
            {savedSessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer ${
                  selectedSessionId === session.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
                onClick={() => handleSessionSelect(session)}
                data-testid={`ledger-session-item-${session.id}`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Bookmark className={`w-4 h-4 flex-shrink-0 ${
                    selectedSessionId === session.id ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <div className="overflow-hidden">
                    <div className="text-sm font-medium truncate">
                      {session.name}
                    </div>
                    {session.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {session.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateSession(session);
                    }}
                    disabled={updatingSessionId === session.id}
                    data-testid={`update-ledger-session-btn-${session.id}`}
                  >
                    {updatingSessionId === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSession(session);
                    }}
                    data-testid={`delete-ledger-session-btn-${session.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("saveSession")}</DialogTitle>
            <DialogDescription>
              {t("saveSessionDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("name")}</label>
              <Input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder={t("namePlaceholder")}
                data-testid="ledger-session-name-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("description")}</label>
              <Textarea
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                data-testid="ledger-session-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveConfirm}
              disabled={isSaving}
              data-testid="confirm-save-ledger-session-btn"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteSession}
        onOpenChange={(open) => !open && setDeleteSession(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmation", { name: deleteSession?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-ledger-session-btn"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

