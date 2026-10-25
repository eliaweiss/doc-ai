"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { SchemaPageProvider } from "./context/SchemaPageProvider";
import { SchemaPageInner } from "./components/SchemaPageInner";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";

export function SchemaPage() {
  const { status } = useSession();
  const { org } = useOrgStore();
  const { logEvent } = useLogUserJourneyEvent();

  useEffect(() => {
    if (status === "authenticated" && org?.id) {
      logEvent({
        eventType: "schema_page_viewed",
      });
    }
  }, [status, org?.id, logEvent]);

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="schema-page-loading"
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
        data-testid="schema-org-loading"
      >
        <LoadingDots message="Loading Schema..." />
      </div>
    );
  }

  // Authenticated - show main app with Schema layout
  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="schema-page-main"
    >
      <AppHeader />

      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="schema-page-content"
      >
        <SchemaPageProvider>
          <SchemaPageInner />
        </SchemaPageProvider>
      </main>
    </div>
  );
}

export default SchemaPage;

