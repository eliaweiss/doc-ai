"use client";

/**
 * doc-ai: Applications page, replacing zdocs' AppsHomePage (which is tied to
 * the AI builder). Same layout as zdocs' AppsPageInner: the quick access bar
 * (apps pinned to the app menu, drag to reorder) on top, then the system apps
 * and mini apps not yet pinned, each with a switch to add it to the menu.
 * Mini apps open view-only at /app/:id; their name, icon and color can be
 * edited and they can be archived or deleted from here. Archived apps are
 * listed in a collapsed "Archived" section, where they can be restored.
 * There is no "Create App" button:
 * mini apps are created through the API (and later the MCP server).
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MiniApp } from "@zdocs/types";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import { QuickAccessBar } from "../app/components/QuickAccessBar";
import { getSystemApps } from "../app/utils/systemApps";
import { AppShortcut } from "../apps/components/AppShortcut";
import { EditMiniAppDialog } from "../ai-builder/components/EditMiniAppDialog";
import { useDeleteMiniApp } from "./useDeleteMiniApp";
import { useArchiveMiniApp } from "./useArchiveMiniApp";
import useOrgStore from "../../context-providers/orgStore";
import useAppStore from "../../context-providers/appStore";
import { useQuickAccess } from "../../context-providers/QuickAccessProvider";

type AppType = "system" | "mini_app";

export function MiniAppsPage() {
  const { status } = useSession();
  const { org } = useOrgStore();
  const { miniApps, miniAppsLoading, updateMiniAppInList } = useAppStore();
  const { enable, disable, isEnabled } = useQuickAccess();
  const router = useRouter();
  const handleDelete = useDeleteMiniApp();
  const setArchived = useArchiveMiniApp();
  const handleArchive = (app: MiniApp) => setArchived(app, true);
  const t = useTranslations("apps");
  const tAppPage = useTranslations("appPage");
  const [editMiniApp, setEditMiniApp] = useState<MiniApp | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  if (status === "loading" || !org?.id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="mini-apps-loading"
      >
        <LoadingDots message="Loading Applications..." />
      </div>
    );
  }

  const togglePinned = async (appId: string, appType: AppType, pinned: boolean) => {
    try {
      if (pinned) await enable({ appId, appType });
      else await disable({ appId, appType });
    } catch {
      toast.error(pinned ? "Failed to enable app" : "Failed to disable app");
    }
  };

  // Pinned apps are shown (and reordered) in the quick access bar
  const unpinnedSystemApps = getSystemApps().filter(
    (app) => !isEnabled(app.id, "system")
  );
  const activeMiniApps = miniApps.filter((app) => !app.archivedAt);
  const archivedMiniApps = miniApps.filter((app) => app.archivedAt);
  const unpinnedMiniApps = activeMiniApps.filter(
    (app) => !isEnabled(app.id, "mini_app")
  );

  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="mini-apps-page"
    >
      <AppHeader />

      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="mx-auto w-full max-w-2xl flex flex-col items-center">
          <h1 className="w-full text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>

          {miniAppsLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingDots />
            </div>
          ) : (
            <>
              <QuickAccessBar
                onEditMiniApp={setEditMiniApp}
                onDeleteMiniApp={handleDelete}
                onArchiveMiniApp={handleArchive}
              />

              <div
                className="w-full flex flex-col gap-2 py-2 md:px-6"
                data-testid="mini-apps-list"
              >
                {unpinnedSystemApps.map((app) => (
                  <AppShortcut
                    key={app.id}
                    name={tAppPage(app.translationKey)}
                    description={tAppPage(`${app.translationKey}Description`)}
                    iconComponent={app.icon}
                    color={app.color}
                    testId={`system-app-card-${app.id}`}
                    onClick={() => router.push(app.path)}
                    showEnableSwitch
                    isEnabled={false}
                    onEnable={() => togglePinned(app.id, "system", true)}
                  />
                ))}

                {unpinnedMiniApps.map((app) => (
                  <AppShortcut
                    key={app.id}
                    name={app.name}
                    description={app.description || undefined}
                    icon={app.icon}
                    color={app.color}
                    testId={`mini-app-card-${app.id}`}
                    onClick={() => router.push(`/app/${app.id}`)}
                    showEnableSwitch
                    isEnabled={false}
                    onEnable={() => togglePinned(app.id, "mini_app", true)}
                    onEdit={() => setEditMiniApp(app)}
                    onArchive={() => handleArchive(app)}
                    onDelete={() => handleDelete(app)}
                  />
                ))}

                {activeMiniApps.length === 0 && (
                  <div
                    className="py-6 text-center text-sm text-muted-foreground"
                    data-testid="mini-apps-empty"
                  >
                    {t("noApps")}
                  </div>
                )}
              </div>

              {archivedMiniApps.length > 0 && (
                <div
                  className="w-full flex flex-col gap-2 border-t border-border py-2 md:px-6"
                  data-testid="archived-mini-apps"
                >
                  <button
                    type="button"
                    onClick={() => setShowArchived((open) => !open)}
                    className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
                    data-testid="archived-mini-apps-toggle"
                  >
                    {showArchived ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    {t("archived")} ({archivedMiniApps.length})
                  </button>

                  {showArchived &&
                    archivedMiniApps.map((app) => (
                      <AppShortcut
                        key={app.id}
                        name={app.name}
                        description={app.description || undefined}
                        icon={app.icon}
                        color={app.color}
                        testId={`archived-mini-app-card-${app.id}`}
                        onClick={() => router.push(`/app/${app.id}`)}
                        onUnarchive={() => setArchived(app, false)}
                        onDelete={() => handleDelete(app)}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <EditMiniAppDialog
        open={editMiniApp !== null}
        onOpenChange={(open) => !open && setEditMiniApp(null)}
        miniApp={editMiniApp}
        orgId={org.id}
        onSuccess={updateMiniAppInList}
      />
    </div>
  );
}

export default MiniAppsPage;
