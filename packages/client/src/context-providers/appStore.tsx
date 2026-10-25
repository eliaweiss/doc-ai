import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { MiniApp } from "@zdocs/types";
import { listMiniAppsApi } from "../utilities/api/miniAppApi";

// Simplified user info from session (not the full database User type)
export interface LoginUserInfo {
  id: string;
  email: string;
  name: string;
}

interface AppState {
  locale: string;
  themeMode: string;
  appInitialized: boolean;
  mockStateId: string | null;
  isKeyboardOpen: boolean;
  keyboardHeight: number;

  // User state
  loginUser: LoginUserInfo | null;

  // Loading state
  isLoading: number;

  // Mini Apps state
  miniApps: MiniApp[];
  miniAppsLoading: boolean;
  miniAppsOrgId: string | null;
}

interface AppActions {
  setLocale: (locale: string) => void;
  setThemeMode: (themeMode: string) => void;
  setAppInitialized: (appInitialized: boolean) => void;
  setMockStateId: (mockStateId: string | null) => void;
  setIsKeyboardOpen: (isKeyboardOpen: boolean) => void;
  setKeyboardHeight: (keyboardHeight: number) => void;

  // User actions
  setLoginUser: (loginUser: LoginUserInfo | null) => void;

  // Loading actions
  setIsLoading: (loading: boolean) => void;

  // Mini Apps actions
  fetchMiniApps: (orgId: string) => Promise<void>;
  refreshMiniApps: (orgId: string) => Promise<void>;
  updateMiniAppInList: (updatedMiniApp: MiniApp) => void;
  clearMiniApps: () => void;
}

type AppStore = AppState & AppActions;

const initialState: AppState = {
  locale: "en",
  themeMode: "dark",
  appInitialized: false,
  mockStateId: null,
  isKeyboardOpen: false,
  keyboardHeight: 0,
  loginUser: null,
  isLoading: 0,
  miniApps: [],
  miniAppsLoading: false,
  miniAppsOrgId: null,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        setThemeMode: (themeMode) => set({ themeMode }),
        setAppInitialized: (appInitialized) => set({ appInitialized }),
        setLocale: (locale) => set({ locale }),
        setMockStateId: (mockStateId) => set({ mockStateId }),
        setIsKeyboardOpen: (isKeyboardOpen) => set({ isKeyboardOpen }),
        setKeyboardHeight: (keyboardHeight) => set({ keyboardHeight }),

        // User actions
        setLoginUser: (loginUser) => set({ loginUser }),

        // Loading actions
        setIsLoading: (loading) => {
          const { isLoading } = get();
          if (loading) {
            set({ isLoading: isLoading + 1 });
          } else {
            set({ isLoading: Math.max(0, isLoading - 1) });
          }
        },

        // Mini Apps actions
        fetchMiniApps: async (orgId: string) => {
          const { miniAppsLoading, miniAppsOrgId } = get();
          // Prevent duplicate fetches: skip if already loading or if we already have data for this org
          if (miniAppsLoading || miniAppsOrgId === orgId) {
            return;
          }
          set({ miniAppsLoading: true });
          try {
            const apps = await listMiniAppsApi(orgId);
            set({ miniApps: apps, miniAppsLoading: false, miniAppsOrgId: orgId });
          } catch (error) {
            console.error("Failed to fetch mini apps:", error);
            set({ miniApps: [], miniAppsLoading: false, miniAppsOrgId: null });
          }
        },
        refreshMiniApps: async (orgId: string) => {
          const { miniAppsLoading } = get();
          if (miniAppsLoading) {
            return;
          }
          set({ miniAppsLoading: true, miniAppsOrgId: null });
          try {
            const apps = await listMiniAppsApi(orgId);
            set({ miniApps: apps, miniAppsLoading: false, miniAppsOrgId: orgId });
          } catch (error) {
            console.error("Failed to refresh mini apps:", error);
            set({ miniApps: [], miniAppsLoading: false, miniAppsOrgId: null });
          }
        },
        updateMiniAppInList: (updatedMiniApp: MiniApp) => {
          const { miniApps } = get();
          const updatedList = miniApps.map((app) =>
            app.id === updatedMiniApp.id ? updatedMiniApp : app
          );
          set({ miniApps: updatedList });
        },
        clearMiniApps: () => set({ miniApps: [], miniAppsLoading: false, miniAppsOrgId: null }),
      }),
      {
        name: "app-storage",
        partialize: (state) => ({
          locale: state.locale,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Reset initialized flag on rehydrate
            state.appInitialized = false;
          }
        },
      }
    )
  )
);

export default useAppStore;
