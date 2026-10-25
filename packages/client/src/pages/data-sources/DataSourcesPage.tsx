"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { DataSourcesProvider } from "./context/DataSourcesProvider";
import { DataSourcesPageInner } from "./components/DataSourcesPageInner";

/**
 * Main Data Sources page.
 *
 * Mirrors the auth-aware shell used by `TasksPage`: shows loading while
 * checking session, prompts for login if unauthenticated, waits for the
 * org to load, then renders the data-sources content inside its provider.
 */
export function DataSourcesPage() {
  const t = useTranslations("dataSources");
  const { status } = useSession();
  const { org } = useOrgStore();

  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="data-sources-page-loading"
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
          data-testid="data-sources-page-loading-spinner"
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
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="data-sources-org-loading"
      >
        <LoadingDots message={t("loading")} />
      </div>
    );
  }

  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="data-sources-page-main"
    >
      <AppHeader />
      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="data-sources-page-content"
      >
        <DataSourcesProvider orgId={org.id} filterMode="data-sources">
          <DataSourcesPageInner />
        </DataSourcesProvider>
      </main>
    </div>
  );
}

export default DataSourcesPage;
