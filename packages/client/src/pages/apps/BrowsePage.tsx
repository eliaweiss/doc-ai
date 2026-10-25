"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import DrivePageComponent from "../drive/components/DrivePageComponent";
import DriveProvider from "../../context-providers/DriveProvider";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";

export function BrowsePage({ showUploadOnInit = false }: { showUploadOnInit?: boolean }) {
  const { status } = useSession();
  const { logEvent } = useLogUserJourneyEvent();

  // Log page view based on auth status
  useEffect(() => {
    if (status === "loading") {
      logEvent({
        eventType: "browse_page_loading",
      });
    } else if (status === "unauthenticated") {
      logEvent({
        eventType: "browse_auth_view_viewed",
      });
    } else if (status === "authenticated") {
      logEvent({
        eventType: "browse_page_viewed",
        eventData: {
          showUploadOnInit,
        },
      });
    }
  }, [status, showUploadOnInit, logEvent]);

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="app-page-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Not authenticated - show login/register
  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  // Authenticated - show main app with drive layout
  return (
    <DriveProvider showUploadOnInit={showUploadOnInit}>
      <div
        className="h-full bg-background flex flex-col overflow-hidden"
        data-testid="app-page-main"
      >
        <AppHeader />

        <main
          className="flex-1 min-h-0 overflow-hidden"
          data-testid="app-page-content"
        >
          <DrivePageComponent />
        </main>
      </div>
    </DriveProvider>
  );
}

export default BrowsePage;
