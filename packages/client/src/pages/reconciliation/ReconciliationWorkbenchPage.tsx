"use client";

import { useSession } from "next-auth/react";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import ReconciliationWorkbenchPageComponent from "./ReconciliationWorkbenchPageComponent";

export function ReconciliationWorkbenchPage() {
  const { status } = useSession();

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="reconciliation-workbench-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Not authenticated - show login/register
  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  // Authenticated - show main app with workbench
  return (
      <div
        className="h-screen bg-background flex flex-col overflow-hidden"
        data-testid="reconciliation-workbench-main"
      >
        <AppHeader />

        <main
          className="flex-1 overflow-hidden"
          data-testid="reconciliation-workbench-content"
        >
          <ReconciliationWorkbenchPageComponent />
      </main>
    </div>
  );
}

export default ReconciliationWorkbenchPage;
