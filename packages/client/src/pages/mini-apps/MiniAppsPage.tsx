"use client";

/**
 * doc-ai: list of mini apps, replacing zdocs' Applications page (AppsHomePage),
 * which is tied to the AI builder. Mini apps open view-only at /app/:id; the
 * switch pins an app to the app menu (quick access). There is no "Create App"
 * button: mini apps are created through the API (and later the MCP server).
 */
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import { AppShortcut } from "../apps/components/AppShortcut";
import useOrgStore from "../../context-providers/orgStore";
import useAppStore from "../../context-providers/appStore";
import { useQuickAccess } from "../../context-providers/QuickAccessProvider";

export function MiniAppsPage() {
  const { status } = useSession();
  const { org } = useOrgStore();
  const { miniApps, miniAppsLoading } = useAppStore();
  const { enable, disable, isEnabled } = useQuickAccess();
  const router = useRouter();
  const t = useTranslations("apps");

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

  const togglePinned = async (appId: string, pinned: boolean) => {
    try {
      if (pinned) await enable({ appId, appType: "mini_app" });
      else await disable({ appId, appType: "mini_app" });
    } catch {
      toast.error(pinned ? "Failed to enable app" : "Failed to disable app");
    }
  };

  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="mini-apps-page"
    >
      <AppHeader />

      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>

          {miniAppsLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingDots />
            </div>
          ) : miniApps.length === 0 ? (
            <div
              className="py-12 text-center text-sm text-muted-foreground"
              data-testid="mini-apps-empty"
            >
              {t("noApps")}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2" data-testid="mini-apps-list">
              {miniApps.map((app) => (
                <AppShortcut
                  key={app.id}
                  name={app.name}
                  description={app.description || undefined}
                  icon={app.icon}
                  color={app.color}
                  testId={`mini-app-card-${app.id}`}
                  onClick={() => router.push(`/app/${app.id}`)}
                  showEnableSwitch
                  isEnabled={isEnabled(app.id, "mini_app")}
                  onEnable={() => togglePinned(app.id, true)}
                  onDisable={() => togglePinned(app.id, false)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default MiniAppsPage;
