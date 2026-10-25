"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { MiniApp } from "@zdocs/types";
import {
  createMiniAppApi,
  loadMiniAppApi,
} from "../../../utilities/api/miniAppApi";
import useOrgStore from "../../../context-providers/orgStore";
import useAppStore from "../../../context-providers/appStore";
import { getUiTxSdkUrl } from "@zdocs/util";

export type MiniAppContextValue = {
  // Current Mini App state
  miniAppId: string | null;
  orgId: string;
  miniApp: MiniApp | null;
  miniAppList: MiniApp[];

  // Loading/error states
  isLoading: boolean;
  error: string | null;

  // Actions
  startNewMiniApp: (
    name: string,
    description?: string,
    color?: string | null,
    icon?: string | null
  ) => Promise<void>;
  loadMiniApp: (miniAppId: string) => Promise<void>;
  refreshMiniAppList: () => Promise<void>;
  updateMiniApp: (updates: Partial<MiniApp>) => void;
};

const MiniAppContext = createContext<MiniAppContextValue | null>(null);

export function useMiniApp() {
  const context = useContext(MiniAppContext);
  if (!context) {
    throw new Error("useMiniApp must be used within a MiniAppProvider");
  }
  return context;
}

export type MiniAppProviderProps = {
  children: ReactNode;
  initialMiniAppId?: string | null;
};

export function MiniAppProvider({
  children,
  initialMiniAppId = null,
}: MiniAppProviderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { org } = useOrgStore();
  const { miniApps, fetchMiniApps, refreshMiniApps, updateMiniAppInList } = useAppStore();
  const orgId = org?.id;
  const userId = session?.user?.id;


  const [miniApp, setMiniApp] = useState<MiniApp | null>(null);
  // If we have initialMiniAppId, we need to load.
  // If we have neither, we need to create a new Mini App.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMiniAppList = useCallback(async () => {
    if (!orgId) return;
    await refreshMiniApps(orgId);
  }, [orgId, refreshMiniApps]);

  // Ensure mini apps are loaded when org changes
  useEffect(() => {
    if (orgId) {
      fetchMiniApps(orgId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Load Mini App on mount (if initialMiniAppId provided)
  useEffect(() => {
    if (initialMiniAppId) {
      // Load existing Mini App
      loadMiniAppInternal(initialMiniAppId);
    } else {
      // No miniAppId provided, don't auto-create - just set loading to false
      setIsLoading(false);
      setMiniApp(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMiniAppId]);

  const loadMiniAppInternal = async (targetMiniAppId: string) => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);

    try {
      const loadedMiniApp = await loadMiniAppApi(orgId, targetMiniAppId);
      setMiniApp(loadedMiniApp);
    } catch (err: any) {
      console.error("Failed to load Mini App:", err);
      const errorMessage = err?.message || "";
      // If mini app not found (404), redirect to base page
      if (
        errorMessage.includes("404") ||
        errorMessage.toLowerCase().includes("not found") ||
        errorMessage.includes("Mini App not found")
      ) {
        router.push("/ai-builder");
        setMiniApp(null);
        setError(null);
      } else {
        setError("Failed to load Mini App. Please try again.");
        setMiniApp(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startNewMiniApp = useCallback(
    async (
      name: string,
      description?: string,
      color?: string | null,
      icon?: string | null
    ) => {
      if (!orgId) return;
      if (!userId) return;
      setIsLoading(true);
      setError(null);
      const uiTxSdkUrl = getUiTxSdkUrl();

      try {
        const newMiniApp = await createMiniAppApi(orgId, {
          userId,
          name,
          description: description || undefined,
          color: color || null,
          icon: icon || null,
          code: `<!DOCTYPE html>
<html>
<head>
  <title>${name}</title>
  <style>
    body { font-family: system-ui; padding: 20px; }
  </style>
</head>
<script src="${uiTxSdkUrl}"></script>
<body>
  <h1>${name}</h1>
  <p>Start building your Mini App!</p>
  

  <script>
    const { uiTx } = window.zDocs;
    // Your code here
  </script>
</body>
</html>`,
          isPublished: false,
        });
        setMiniApp(newMiniApp);
        // Refresh the mini apps list to include the newly created app
        await refreshMiniAppList();
        // Update URL without full page reload
        router.push(`/ai-builder/${newMiniApp.id}`);
      } catch (err) {
        console.error("Failed to create Mini App:", err);
        setError("Failed to create Mini App. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [orgId, userId, router, refreshMiniAppList]
  );

  const loadMiniApp = useCallback(
    async (newMiniAppId: string) => {
      await loadMiniAppInternal(newMiniAppId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [orgId]
  );

  const updateMiniApp = useCallback(
    (updates: Partial<MiniApp> & { id?: string }) => {
      const targetId = updates.id;
      // If updating the currently loaded mini app, update local state
      if (miniApp && (!targetId || targetId === miniApp.id)) {
        const updatedMiniApp = { ...miniApp, ...updates };
        setMiniApp(updatedMiniApp);
        updateMiniAppInList(updatedMiniApp);
      } else if (targetId) {
        // Updating a different mini app (from sidebar), find it in the list
        const existingApp = miniApps.find((app) => app.id === targetId);
        if (existingApp) {
          updateMiniAppInList({ ...existingApp, ...updates });
        }
      }
    },
    [miniApp, miniApps, updateMiniAppInList]
  );

  const value: MiniAppContextValue = {
    miniAppId: miniApp?.id ?? null,
    orgId: orgId ?? "",
    miniApp,
    miniAppList: miniApps,
    isLoading,
    error,
    startNewMiniApp,
    loadMiniApp,
    refreshMiniAppList,
    updateMiniApp,
  };

  return (
    <MiniAppContext.Provider value={value}>{children}</MiniAppContext.Provider>
  );
}

export default MiniAppProvider;
