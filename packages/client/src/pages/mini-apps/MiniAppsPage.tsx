"use client";

/**
 * doc-ai: Applications page, replacing zdocs' AppsHomePage (which is tied to
 * the AI builder). Same layout as zdocs' AppsPageInner: the quick access bar
 * (apps pinned to the app menu, drag to reorder) on top, then the system apps
 * and mini apps not yet pinned, each with a switch to add it to the menu.
 * Mini apps open view-only at /app/:id. There is no "Create App" button: mini
 * apps are created through the API (and later the MCP server).
 */
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import { QuickAccessBar } from "../app/components/QuickAccessBar";
import { getSystemApps } from "../app/utils/systemApps";
import { AppShortcut } from "../apps/components/AppShortcut";
import useOrgStore from "../../context-providers/orgStore";
import useAppStore from "../../context-providers/appStore";
import { useQuickAccess } from "../../context-providers/QuickAccessProvider";

type AppType = "system" | "mini_app";

export function MiniAppsPage() {
  const { status } = useSession();
  const { org } = useOrgStore();
  const { miniApps, miniAppsLoading } = useAppStore();
  const { enable, disable, isEnabled } = useQuickAccess();
  const router = useRouter();
  const t = useTranslations("apps");
  const tAppPage = useTranslations("appPage");

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
  const unpinnedMiniApps = miniApps.filter(
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
              <QuickAccessBar />

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
                  />
                ))}

                {miniApps.length === 0 && (
                  <div
                    className="py-6 text-center text-sm text-muted-foreground"
                    data-testid="mini-apps-empty"
                  >
                    {t("noApps")}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default MiniAppsPage;
