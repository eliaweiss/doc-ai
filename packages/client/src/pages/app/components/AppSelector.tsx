"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useQuickAccess } from "../../../context-providers/QuickAccessProvider";
import { getSystemApps } from "../utils/systemApps";
import useOrgStore from "../../../context-providers/orgStore";
import useAppStore from "../../../context-providers/appStore";
import { loadMiniAppApi } from "../../../utilities/api/miniAppApi";
import type { MiniApp } from "@zdocs/types";
import { cn } from "@zdocs/util";
import { AppIcon } from "./AppIcon";
import { AppLabel } from "./AppLabel";
import {
  type AppItem,
  systemAppToAppItem,
  miniAppToAppItem,
} from "./types";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

export function AppSelector() {
  const t = useTranslations("appPage");
  const pathname = usePathname();
  const router = useRouter();
  const { org } = useOrgStore();
  const { miniApps, setIsLoading } = useAppStore();
  const { menuItems } = useQuickAccess();
  const { logEvent } = useLogUserJourneyEvent();
  const [currentMiniApp, setCurrentMiniApp] = useState<MiniApp | null>(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

  // Extract mini app ID from pathname if we're on a mini app page
  // doc-ai: mini apps open at /app/:id (view only) instead of /ai-builder/:id
  const currentMiniAppId = useMemo(() => {
    if (pathname?.startsWith("/app/")) {
      const match = pathname.match(/\/app\/([^/?]+)/);
      return match ? match[1] : null;
    }
    return null;
  }, [pathname]);

  // Set current mini app from store or fetch if not available
  useEffect(() => {
    if (!org?.id || !currentMiniAppId) {
      setCurrentMiniApp(null);
      return;
    }

    // Check if it's in the store
    const inStore = miniApps.find((app) => app.id === currentMiniAppId);
    if (inStore) {
      setCurrentMiniApp(inStore);
      return;
    }

    // Fetch the current mini app if not in store (e.g., direct URL access)
    loadMiniAppApi(org.id, currentMiniAppId)
      .then((app) => {
        setCurrentMiniApp(app);
      })
      .catch((err) => {
        console.error("Failed to load current mini app:", err);
        setCurrentMiniApp(null);
      });
  }, [org?.id, currentMiniAppId, miniApps]);

  // Detect current system app from pathname
  const currentSystemApp = useMemo(() => {
    if (!pathname) return null;
    return getSystemApps().find(
      (app) =>
        pathname === app.path || pathname.startsWith(app.path + "/")
    ) || null;
  }, [pathname]);

  const pathFirstPart = useMemo(() => {
    if (!pathname) return null;
    return pathname.split("/")[1];
  }, [pathname]);

  const currentMode = useCallback(() => {
    // Check if pathname matches any menu item
    const match = menuItems.find((item) => {
      if (pathname === item.path) return true;
      if (
        item.path.startsWith("/app/") &&
        pathname?.startsWith("/app/")
      ) {
        const itemAppId = item.path.split("/app/")[1]?.split("?")[0];
        const pathAppId = pathname.split("/app/")[1]?.split("?")[0];
        return itemAppId === pathAppId;
      }
    // Don't match the /ai-builder root item when on a specific mini-app page
    if (item.path === "/ai-builder" && pathname?.startsWith("/ai-builder/")) {
      return false;
    }
    return pathname?.startsWith(item.path);
    });
    if (match) return match.mode;

    // If we're on an ai-builder page but not in quick access, return a special mode
    // Check this BEFORE system app check to prioritize mini apps
    if (currentMiniAppId) {
      return `mini-app-${currentMiniAppId}`;
    }

    // If we're on a system app page but not in quick access, return the system app mode
    if (currentSystemApp) {
      return currentSystemApp.id;
    }

    // Fallback to pathFirstPart for other pages (e.g., documents)
    return pathFirstPart || "home";
  }, [pathname, menuItems, currentMiniAppId, currentSystemApp, pathFirstPart]);

  // Get current app item (from menu or current system/mini app)
  const currentAppItem = useMemo((): AppItem | null => {
    const currentModeValue = currentMode();
    const menuItem = menuItems.find((item) => item.mode === currentModeValue);

    if (menuItem) return menuItem;

    // If we have a current system app that's not in quick access
    if (currentSystemApp && currentModeValue === currentSystemApp.id) {
      return systemAppToAppItem(
        currentSystemApp,
        t(currentSystemApp.translationKey)
      );
    }

    // If we have a current mini app that's not in quick access
    if (currentMiniApp && currentModeValue.startsWith("mini-app-")) {
      return miniAppToAppItem(currentMiniApp);
    }

    return null;
  }, [currentMode, menuItems, currentSystemApp, currentMiniApp, t]);

  const handleModeSelect = (mode: string) => {
    setIsModeMenuOpen(false);
    const item = menuItems.find((item) => item.mode === mode);
    if (item) {
      logEvent({
        eventType: "browse_header_app_selected",
        eventData: {
          appMode: mode,
          appPath: item.path,
          appType: item.type,
        },
      });
      setIsLoading(true);
      router.push(item.path);
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  };

  return (
    <div className="relative" data-testid="mode-switcher">
      <button
        onClick={() => {
          setIsModeMenuOpen(!isModeMenuOpen);
          if (!isModeMenuOpen) {
            logEvent({
              eventType: "browse_header_app_menu_opened",
            });
          }
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors border border-border"
        data-testid="mode-switcher-btn"
      >
        {currentAppItem ? (
          <>
            <AppIcon
              icon={currentAppItem.icon}
              iconName={currentAppItem.iconName}
              color={currentAppItem.color || "#ffffff"}
              isMiniApp={currentAppItem.isMiniApp}
              size={16}
            />
            <AppLabel name={currentAppItem.name} />
          </>
        ) : (
          <>
            <AppIcon isMiniApp={false} size={16} />
            <AppLabel name={pathFirstPart || ""} />
          </>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      {isModeMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsModeMenuOpen(false)}
          />
          <div
            className="absolute left-0 top-full mt-1 w-80 bg-card border border-border rounded-lg shadow-lg z-20"
            data-testid="mode-menu"
          >
            {menuItems.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === menuItems.length - 1;
              const isActive = currentMode() === item.mode;
              return (
                <button
                  key={item.id}
                  onClick={() => handleModeSelect(item.mode)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2",
                    isFirst ? "rounded-t-lg" : "",
                    isLast ? "rounded-b-lg border-t-1 border bg-slate-50" : "",
                    isActive ? "bg-accent" : ""
                  )}
                  data-testid={`mode-option-${item.mode}`}
                >
                  <AppIcon
                    icon={item.icon}
                    iconName={item.iconName}
                    color={item.color || "#ffffff"}
                    isMiniApp={item.isMiniApp}
                    size={16}
                  />
                  <span className="text-foreground">{item.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
