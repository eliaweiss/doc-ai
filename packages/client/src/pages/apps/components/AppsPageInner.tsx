"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2 } from "lucide-react";
import { Button, cn } from "@zdocs/client-component";
import { useMiniApp } from "../../ai-builder/context/MiniAppProvider";
import { CreateMiniAppDialog } from "../../ai-builder/components/CreateMiniAppDialog";
import { getSystemApps } from "../../app/utils/systemApps";
import { AppShortcut } from "./AppShortcut";
import { YouTube } from "./YouTube";
import { useQuickAccess } from "../../../context-providers/QuickAccessProvider";
import { toast } from "sonner";
import { QuickAccessBar } from "../../app/components/QuickAccessBar";
import { IS_DOC_VISION, isMobileWidth } from "@zdocs/util";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import { useAppStore } from "packages/client/src/context-providers/appStore";


export function AppsPageInner() {
  const { miniAppsLoading } = useAppStore();
  const t = useTranslations("apps");
  const tAppPage = useTranslations("appPage");
  const { logEvent } = useLogUserJourneyEvent();
  const {
    miniAppList,
    isLoading: isListLoading,
    refreshMiniAppList,
  } = useMiniApp();
  const { enable, disable, isEnabled } = useQuickAccess();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => isMobileWidth());
  const sortedMiniAppList = [...miniAppList]
    .filter((app) => !isEnabled(app.id, "mini_app"))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  const youtubeUrl1 = "https://youtu.be/S8a188YR-HA";
  const youtubeUrl2 = "https://youtu.be/LMlHVpvzBiA";

  const filteredSystemApps = getSystemApps().filter(
    (app) => !isEnabled(app.id, "system")
  );

  useEffect(() => {
    logEvent({
      eventType: "apps_page_viewed",
      eventData: { page: "apps" },
    });
  }, [logEvent]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileWidth());
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleVideoPlay = (index: number) => {
    logEvent({
      eventType: "video_played",
      eventData: { videoName: `home-app-introduction-${index}`, page: "apps" },
    });
  };

  const handleEnableSystemApp = async (appId: string) => {
    try {
      await enable({ appId, appType: "system" });
      logEvent({
        eventType: "app_enabled",
        eventData: { appId, appType: "system" },
      });
      toast.success("App enabled in quick access");
    } catch (error) {
      logEvent({
        eventType: "app_enable_error",
        eventData: { appId, appType: "system" },
      });
      toast.error("Failed to enable app");
    }
  };

  const handleDisableSystemApp = async (appId: string) => {
    try {
      await disable({ appId, appType: "system" });
      logEvent({
        eventType: "app_disabled",
        eventData: { appId, appType: "system" },
      });
      toast.success("App disabled from quick access");
    } catch (error) {
      logEvent({
        eventType: "app_disable_error",
        eventData: { appId, appType: "system" },
      });
      toast.error("Failed to disable app");
    }
  };

  const handleEnableMiniApp = async (appId: string) => {
    try {
      await enable({ appId, appType: "mini_app" });
      logEvent({
        eventType: "app_enabled",
        eventData: { appId, appType: "mini_app" },
      });
      toast.success("App enabled in quick access");
    } catch (error) {
      logEvent({
        eventType: "app_enable_error",
        eventData: { appId, appType: "mini_app" },
      });
      toast.error("Failed to enable app");
    }
  };

  const handleDisableMiniApp = async (appId: string) => {
    try {
      await disable({ appId, appType: "mini_app" });
      logEvent({
        eventType: "app_disabled",
        eventData: { appId, appType: "mini_app" },
      });
      toast.success("App disabled from quick access");
    } catch (error) {
      logEvent({
        eventType: "app_disable_error",
        eventData: { appId, appType: "mini_app" },
      });
      toast.error("Failed to disable app");
    }
  };

  if (isListLoading || miniAppsLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="apps-loading"
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      data-testid="apps-page-inner"
    >
      {/* Header */}
      <div className={cn("border-b border-border px-6 py-4 flex items-center justify-start relative",
        IS_DOC_VISION ? "hidden" : "")}>
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
        {!isMobile && (
          <Button
            onClick={() => {
              logEvent({
                eventType: "create_app_clicked",
                eventData: { page: "apps" },
              });
              setCreateDialogOpen(true);
            }}
            data-testid="create-app-btn"
            className="absolute right-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("createApp")}
          </Button>
        )}
      </div>

      {IS_DOC_VISION && isMobile && (
        <div
          className="px-4 pt-4 md:hidden"
          data-testid="doc-vision-mobile-notice-wrapper"
        >
          <div
            className="rounded-lg border-2 border-blue-500/40 bg-blue-500/15 p-4 shadow-sm ring-1 ring-blue-500/20"
            data-testid="doc-vision-mobile-notice"
          >
            <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
              {t("docVisionMobileNoticeTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground/90">
              {t("docVisionMobileNoticeDescription")}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-2" data-testid="apps-home-content">
        {/* Two Column Layout: Apps (left) and Video (right) */}
        <div
          className="mt-2 flex flex-col gap-6 md:flex-row"
          data-testid="apps-video-layout"
        >
          {/* Left Column: Apps */}
          <div
            className="flex flex-1 flex-col items-center"
            data-testid="apps-column"
          >
            <QuickAccessBar />

            <div
              className="hidden w-full flex-col gap-2 border-b border-border px-6 py-2 md:flex"
              data-testid="system-apps-grid"
            >
              {filteredSystemApps.map((app) => (
                <AppShortcut
                  key={app.id}
                  name={tAppPage(app.translationKey)}
                  description={tAppPage(`${app.translationKey}Description`)}
                  iconComponent={app.icon}
                  color={app.color}
                  testId={`system-app-card-${app.id}`}
                  showEnableSwitch
                  isEnabled={isEnabled(app.id, "system")}
                  onEnable={() => handleEnableSystemApp(app.id)}
                  onDisable={() => handleDisableSystemApp(app.id)}
                  disabled
                />
              ))}

              {/* Mini Apps Grid */}
              {sortedMiniAppList.map((app) => (
                <AppShortcut
                  key={app.id}
                  name={app.name}
                  icon={app.icon}
                  color={app.color}
                  testId={`app-card-${app.id}`}
                  showEnableSwitch
                  isEnabled={isEnabled(app.id, "mini_app")}
                  onEnable={() => handleEnableMiniApp(app.id)}
                  onDisable={() => handleDisableMiniApp(app.id)}
                  disabled
                />
              ))}
            </div>
          </div>

          {/* Right Column: Video */}
          <div
            className="flex flex-1 flex-col items-start justify-center gap-4 md:sticky md:top-6 md:self-start"
            data-testid="video-column"
          >
            <div
              className="w-full max-w-[600px]"
              data-testid="intro-video-container-1"
            >
              <YouTube
                src={youtubeUrl1}
                onPlay={() => handleVideoPlay(1)}
                dataTestid="intro-video-player1"
              />
            </div>
            <div
              className="w-full max-w-[600px]"
              data-testid="intro-video-container-2"
            >
              <YouTube
                src={youtubeUrl2}
                onPlay={() => handleVideoPlay(2)}
                dataTestid="intro-video-player2"
              />
            </div>
          </div>
        </div>
      </div>

      <CreateMiniAppDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refreshMiniAppList}
      />
    </div>
  );
}
