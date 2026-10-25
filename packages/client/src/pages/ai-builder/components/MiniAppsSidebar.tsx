"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2, RefreshCw, Settings } from "lucide-react";
import { Button } from "@zdocs/client-component";
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
import { useRouter, useParams } from "next/navigation";
import type { MiniApp } from "@zdocs/types";
import { useMiniApp } from "../context/MiniAppProvider";
import { deleteMiniAppApi } from "../../../utilities/api/miniAppApi";
import { CreateMiniAppDialog } from "./CreateMiniAppDialog";
import { EditMiniAppDialog } from "./EditMiniAppDialog";
import { IconDisplay } from "./IconDisplay";
import { getTextColorForBackground } from "@zdocs/client-component";

export function MiniAppsSidebar() {
  const {
    miniAppList,
    isLoading: isListLoading,
    refreshMiniAppList,
    orgId,
  } = useMiniApp();
  const t = useTranslations("aiBuilder");
  const router = useRouter();
  const params = useParams();
  const currentMiniAppId = params.miniAppId as string;

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteMiniApp, setDeleteMiniApp] = useState<MiniApp | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editMiniApp, setEditMiniApp] = useState<MiniApp | null>(null);

  const sortedMiniAppList = [...miniAppList].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const handleDeleteConfirm = async () => {
    if (!deleteMiniApp) return;

    const isCurrentMiniApp = currentMiniAppId === deleteMiniApp.id;

    setIsDeleting(deleteMiniApp.id);
    try {
      await deleteMiniAppApi(orgId, deleteMiniApp.id);
      toast.success(t("miniAppDeleted"));

      // If we deleted the current Mini App, navigate immediately to prevent loading errors
      if (isCurrentMiniApp) {
        router.push("/ai-builder");
      }

      await refreshMiniAppList();
    } catch (error) {
      console.error("Failed to delete Mini App:", error);
      toast.error(t("deleteMiniAppFailed"));
    } finally {
      setIsDeleting(null);
      setDeleteMiniApp(null);
    }
  };

  const handleMiniAppClick = (miniAppId: string) => {
    if (miniAppId === currentMiniAppId) return;
    router.push(`/ai-builder/${miniAppId}`);
  };

  return (
    <div className="flex flex-col h-full" data-testid="mini-apps-sidebar">
      {/* Header with New Mini App button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{t("miniApps")}</h3>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setCreateDialogOpen(true)}
          data-testid="new-miniapp-sidebar-btn"
        >
          <Plus className="w-3 h-3 mr-1" />
          {t("newMiniApp")}
        </Button>
      </div>

      {/* Mini Apps List */}
      <div className="flex-1 overflow-y-auto">
        {isListLoading && miniAppList.length === 0 ? (
          <div
            className="flex items-center justify-center py-8"
            data-testid="mini-apps-loading"
          >
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : sortedMiniAppList.length === 0 ? (
          <div
            className="text-center py-8 text-muted-foreground text-sm"
            data-testid="mini-apps-empty"
          >
            <p>{t("noMiniApps")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setCreateDialogOpen(true)}
              data-testid="new-miniapp-empty-btn"
            >
              <Plus className="w-3 h-3 mr-1" />
              {t("createFirstMiniApp")}
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedMiniAppList.map((app) => {
              const isActive = app.id === currentMiniAppId;
              const isDeletingThis = isDeleting === app.id;

              return (
                <div
                  key={app.id}
                  className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                    }`}
                  onClick={() => handleMiniAppClick(app.id)}
                  data-testid={`mini-app-item-${app.id}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {app.icon && app.color && /^#[0-9A-Fa-f]{6}$/.test(app.color) ? (
                      <div
                        className="flex-shrink-0 rounded p-1.5 flex items-center justify-center"
                        style={{ backgroundColor: app.color }}
                        data-testid={`mini-app-icon-bg-${app.id}`}
                      >
                        <IconDisplay
                          iconName={app.icon}
                          size={14}
                          color={getTextColorForBackground(app.color)}
                        />
                      </div>
                    ) : (
                      <IconDisplay
                        iconName={app.icon}
                        size={16}
                        className="flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {app.name}
                      </div>
                      {app.description && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {app.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditMiniApp(app);
                      }}
                      className="p-1 hover:bg-accent rounded transition-colors"
                      data-testid={`edit-miniapp-btn-${app.id}`}
                    >
                      <Settings className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteMiniApp(app);
                      }}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors"
                      data-testid={`delete-miniapp-btn-${app.id}`}
                      disabled={isDeletingThis}
                    >
                      {isDeletingThis ? (
                        <Loader2 className="w-3 h-3 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="w-3 h-3 text-destructive" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Refresh button */}
      <div className="pt-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={refreshMiniAppList}
          data-testid="refresh-miniapps-btn"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          {t("refresh")}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteMiniApp !== null}
        onOpenChange={(open) => !open && setDeleteMiniApp(null)}
      >
        <AlertDialogContent data-testid="delete-miniapp-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteMiniAppTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteMiniAppConfirmation", { name: deleteMiniApp?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-miniapp-btn"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateMiniAppDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refreshMiniAppList}
      />

      <EditMiniAppDialog
        open={editMiniApp !== null}
        onOpenChange={(open) => !open && setEditMiniApp(null)}
        miniApp={editMiniApp}
        onSuccess={refreshMiniAppList}
      />
    </div>
  );
}
