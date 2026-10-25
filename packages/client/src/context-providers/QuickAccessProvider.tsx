"use client";

import { Grid3x3 } from "lucide-react";
import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import useOrgStore from "./orgStore";
import useAppStore from "./appStore";
import {
  listQuickAccess,
  enableApp,
  disableApp,
  reorderQuickAccess,
  type EnableAppParams,
  type DisableAppParams,
} from "../utilities/api/quickAccessApi";
import type { QuickAccessItem } from "@zdocs/types";
import { getSystemApps } from "../pages/app/utils/systemApps";
import {
  type AppItem,
  systemAppToAppItem,
  miniAppToAppItem,
} from "../pages/app/components/types";

interface QuickAccessContextValue {
  items: QuickAccessItem[];
  menuItems: AppItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  enable: (params: Omit<EnableAppParams, "orgId">) => Promise<void>;
  disable: (params: Omit<DisableAppParams, "orgId">) => Promise<void>;
  reorder: (itemIds: string[]) => Promise<void>;
  isEnabled: (appId: string, appType: "system" | "mini_app") => boolean;
}

const QuickAccessContext = createContext<QuickAccessContextValue | undefined>(
  undefined
);

export function QuickAccessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const { org } = useOrgStore();
  const { miniApps } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("appPage");
  const [items, setItems] = useState<QuickAccessItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedOrgIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const previousOrgIdRef = useRef<string | null>(null);
  const hasRoutedForOrgRef = useRef<string | null>(null);

  // Build menu items from quick access
  const menuItems = useMemo(() => {
    const menuItemsList: AppItem[] = [];

    // Add quick access items
    items.forEach((item) => {
      if (item.appType === "system") {
        const systemApp = getSystemApps().find((app) => app.id === item.appId);
        if (systemApp) {
          menuItemsList.push(systemAppToAppItem(systemApp, t(systemApp.translationKey)));
        }
      } else {
        const miniApp = miniApps.find((app) => app.id === item.appId && !app.archivedAt);
        if (miniApp) {
          menuItemsList.push(miniAppToAppItem(miniApp));
        }
      }
    });

    // doc-ai: "Applications" opens the mini-app list (/apps) instead of /home
    menuItemsList.push({
      id: "home",
      name: t("modeApps"),
      path: "/apps",
      icon: Grid3x3,
      color: "#6b7280", // gray
      mode: "home",
      isMiniApp: false,
    });

    return menuItemsList;
  }, [items, miniApps, t]);

  // Load quick access items when org or session changes
  useEffect(() => {
    if (!org?.id || !session?.user?.id) {
      setItems([]);
      setIsLoading(false);
      lastFetchedOrgIdRef.current = null;
      isLoadingRef.current = false;
      previousOrgIdRef.current = null;
      hasRoutedForOrgRef.current = null;
      return;
    }

    // Track if this is an org change (not initial mount)
    const isOrgChange = previousOrgIdRef.current !== null && previousOrgIdRef.current !== org.id;
    previousOrgIdRef.current = org.id;

    // Reset routing flag on org change
    if (isOrgChange) {
      hasRoutedForOrgRef.current = null;
    }

    // Prevent duplicate fetches: skip if already loading or if we already have data for this org
    if (isLoadingRef.current || lastFetchedOrgIdRef.current === org.id) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    listQuickAccess(org.id)
      .then((data) => {
        setItems(data);
        lastFetchedOrgIdRef.current = org.id;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load quick access");
        console.error("Error loading quick access:", err);
        lastFetchedOrgIdRef.current = null;
      })
      .finally(() => {
        isLoadingRef.current = false;
        setIsLoading(false);
      });
  }, [org?.id, session?.user?.id]);

  // // Route to first pinned item when org changes (not on initial mount)
  // useEffect(() => {
  //   // Only route if:
  //   // 1. We have an org
  //   // 2. We're not loading
  //   // 3. Current path is root "/"
  //   // 4. We have menu items (at least one pinned item beyond the "apps" fallback)
  //   // 5. We haven't already routed for this org (hasRoutedForOrgRef tracks last routed org)
  //   // 6. This is an org change (previousOrgIdRef was set before, meaning not initial mount)
  //   const isOrgChange = previousOrgIdRef.current !== null && hasRoutedForOrgRef.current !== org?.id;

  //   if (
  //     org?.id &&
  //     !isLoading &&
  //     pathname === "/" &&
  //     menuItems.length > 1 &&
  //     isOrgChange
  //   ) {
  //     const firstPinnedItem = menuItems[0];
  //     if (firstPinnedItem && firstPinnedItem.id !== "apps") {
  //       hasRoutedForOrgRef.current = org.id;
  //       router.push(firstPinnedItem.path);
  //     }
  //   }
  // }, [org?.id, menuItems, isLoading, router, pathname]);

  const refresh = useCallback(async () => {
    if (!org?.id || !session?.user?.id) {
      setItems([]);
      setIsLoading(false);
      lastFetchedOrgIdRef.current = null;
      isLoadingRef.current = false;
      return;
    }

    // Reset the ref to force a fresh fetch
    lastFetchedOrgIdRef.current = null;
    isLoadingRef.current = false;

    setIsLoading(true);
    setError(null);
    try {
      const data = await listQuickAccess(org.id);
      setItems(data);
      lastFetchedOrgIdRef.current = org.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quick access");
      console.error("Error loading quick access:", err);
      lastFetchedOrgIdRef.current = null;
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [org?.id, session?.user?.id]);

  const handleEnable = useCallback(
    async (params: Omit<EnableAppParams, "orgId">) => {
      if (!org?.id) return;

      try {
        await enableApp({ ...params, orgId: org.id });
        await refresh();
      } catch (err) {
        console.error("Error enabling app:", err);
        throw err;
      }
    },
    [org?.id, refresh]
  );

  const handleDisable = useCallback(
    async (params: Omit<DisableAppParams, "orgId">) => {
      if (!org?.id) return;

      try {
        await disableApp({ ...params, orgId: org.id });
        await refresh();
      } catch (err) {
        console.error("Error disabling app:", err);
        throw err;
      }
    },
    [org?.id, refresh]
  );

  const handleReorder = useCallback(
    async (itemIds: string[]) => {
      if (!org?.id) return;

      try {
        await reorderQuickAccess({ orgId: org.id, itemIds });
        await refresh();
      } catch (err) {
        console.error("Error reordering quick access:", err);
        throw err;
      }
    },
    [org?.id, refresh]
  );

  const isEnabled = useCallback(
    (appId: string, appType: "system" | "mini_app") => {
      return items.some(
        (item) => item.appId === appId && item.appType === appType
      );
    },
    [items]
  );

  return (
    <QuickAccessContext.Provider
      value={{
        items,
        menuItems,
        isLoading,
        error,
        refresh,
        enable: handleEnable,
        disable: handleDisable,
        reorder: handleReorder,
        isEnabled,
      }}
    >
      {children}
    </QuickAccessContext.Provider>
  );
}

export function useQuickAccess() {
  const context = useContext(QuickAccessContext);
  if (context === undefined) {
    throw new Error("useQuickAccess must be used within QuickAccessProvider");
  }
  return context;
}
