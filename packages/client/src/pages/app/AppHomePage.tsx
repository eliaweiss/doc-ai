"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppAuthView } from "./AppAuthView";
import AppsHomePage from "../apps/AppsHomePage";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";
import { trackSignupConversion } from "../../utilities/trackGoogleAdsConversion";

const OAUTH_FLAG_KEY = "oauth_in_progress";
const OAUTH_TIMEOUT_MS = 15_000;

export function AppHomePage() {
  const { status } = useSession();
  const { logEvent } = useLogUserJourneyEvent();
  const [waitingForOAuth, setWaitingForOAuth] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!sessionStorage.getItem(OAUTH_FLAG_KEY);
  });

  useEffect(() => {
    if (!waitingForOAuth) return;

    if (status === "authenticated") {
      const method = sessionStorage.getItem(OAUTH_FLAG_KEY) || "google";
      sessionStorage.removeItem(OAUTH_FLAG_KEY);
      setWaitingForOAuth(false);
      logEvent({
        eventType: "login_success",
        eventData: { method },
      });
      trackSignupConversion();
      return;
    }

    const timeout = setTimeout(() => {
      sessionStorage.removeItem(OAUTH_FLAG_KEY);
      setWaitingForOAuth(false);
    }, OAUTH_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [waitingForOAuth, status, logEvent]);

  const showLoading = status === "loading" || waitingForOAuth;

  if (showLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="app-page-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  return (
    <div
      className="h-full bg-background flex flex-col overflow-hidden"
      data-testid="app-page-main"
    >
      <main
        className="flex-1 min-h-0 overflow-hidden"
        data-testid="app-page-content"
      >
        <AppsHomePage />
      </main>
    </div>
  );
}

export default AppHomePage;
