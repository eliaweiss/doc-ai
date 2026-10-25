"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LoadingDots } from "@zdocs/client-component";
import { toast } from "sonner";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { IntegrationsPageInner, INTEGRATIONS } from "./components/IntegrationsPageInner";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";

export function IntegrationsPage() {
  const t = useTranslations("apps.integrations");
  const { status } = useSession();
  const { org } = useOrgStore();
  const { logEvent } = useLogUserJourneyEvent();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hasAuthRequired = INTEGRATIONS.some(
      (def) => params.get(def.queryParam) === "auth_required"
    );
    if (!hasAuthRequired) return;
    window.history.replaceState({}, "", window.location.pathname);
    toast.error(t("oauthAuthRequired"));
  }, [status, t]);

  useEffect(() => {
    if (status === "authenticated" && org?.id) {
      logEvent({
        eventType: "integrations_page_viewed",
      });
    }
  }, [status, org?.id, logEvent]);

  if (status === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        data-testid="integrations-page-loading"
      >
        <div
          className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary"
          data-testid="integrations-page-loading-spinner"
        />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  if (!org?.id) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        data-testid="integrations-org-loading"
      >
        <LoadingDots message={t("loading")} />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-background"
      data-testid="integrations-page-main"
    >
      <AppHeader />

      <main
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6"
        data-testid="integrations-page-content"
      >
        <IntegrationsPageInner />
      </main>
    </div>
  );
}

export default IntegrationsPage;
