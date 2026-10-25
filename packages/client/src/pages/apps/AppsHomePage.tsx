"use client";

import { useSession } from "next-auth/react";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { MiniAppProvider } from "../ai-builder/context/MiniAppProvider";
import { AppsPageInner } from "./components/AppsPageInner";

export function AppsHomePage() {
  const { status } = useSession();
  const { org } = useOrgStore();

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="apps-page-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Not authenticated - show login/register
  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  // Wait for org to be loaded
  if (!org?.id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="apps-org-loading"
      >
        <LoadingDots message="Loading Applications..." />
      </div>
    );
  }

  // Authenticated - show main app with Applications layout
  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="apps-page-main"
    >
      <AppHeader />

      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="apps-page-content"
      >
        <MiniAppProvider>
          <AppsPageInner />
        </MiniAppProvider>
      </main>
    </div>
  );
}

export default AppsHomePage;
