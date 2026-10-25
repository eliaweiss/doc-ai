"use client";

// AppProvider.js
import React, { createContext, useContext, useEffect } from "react";
import useAppStore from "./appStore";
import useOrgStore from "./orgStore";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import "@zdocs/types"; // Import for next-auth module augmentation
import { QuickAccessProvider } from "./QuickAccessProvider";
import { ConfirmProvider } from "./confirm-provider/ConfirmProvider";

type AppStore = ReturnType<typeof useAppStore>;

// Create the context
const AppContext = createContext<AppStore | null>(null);

// Create a custom hook for easy access to the context
export const useAppContext = () => {
  return useContext(AppContext);
};

export { AppContext };

const AppProvider = ({
  children,
  initTheme = true,
}: {
  children: React.ReactNode;
  initTheme?: boolean;
}) => {
  const { setMockStateId, setLoginUser, setAppInitialized, appInitialized, fetchMiniApps, clearMiniApps } =
    useAppStore();
  const { setOrg, fetchOrganizations, org } = useOrgStore();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  // Extract user ID as a primitive to avoid object reference changes triggering effect
  const sessionUserId = (
    session?.user as { id?: string } | undefined
  )?.id;
  const sessionUserEmail = session?.user?.email;
  const sessionUserName = session?.user?.name;

  // Handle mockStateId from search params
  useEffect(() => {
    const mockStateId = searchParams.get("mockStateId");
    if (mockStateId) {
      setMockStateId(mockStateId);
    }
  }, [searchParams, setMockStateId]);

  // Load mini apps when org changes
  useEffect(() => {
    if (org?.id) {
      fetchMiniApps(org.id);
    } else {
      clearMiniApps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  // Initialize app state when session is available
  useEffect(() => {
    if (status === "loading") return;

    if (sessionUserId) {
      // Skip if already initialized
      if (appInitialized) return;

      setLoginUser({
        id: sessionUserId,
        email: sessionUserEmail || "",
        name: sessionUserName || "",
      });

      // Fetch organizations using the centralized store method
      fetchOrganizations()
        .then(() => {
          setAppInitialized(true);
        })
        .catch((error) => {
          console.error("Failed to fetch organizations:", error);
          setAppInitialized(true);
        });
    } else if (status === "unauthenticated") {
      setLoginUser(null);
      setOrg(null);
      setAppInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId, status, appInitialized]);

  return (
    <AppContext.Provider value={useAppStore()}>
      <ConfirmProvider>

        <QuickAccessProvider>{children}</QuickAccessProvider>
      </ConfirmProvider>
    </AppContext.Provider>
  );
};

export default AppProvider;
