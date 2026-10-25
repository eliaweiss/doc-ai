"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Landmark } from "lucide-react";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { DataSourcesProvider } from "./context/DataSourcesProvider";
import { DataSourcesPageInner } from "./components/DataSourcesPageInner";

export function BankLinksPage() {
  const t = useTranslations("bankLinks");
  const { status } = useSession();
  const { org } = useOrgStore();

  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="bank-links-page-loading"
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
          data-testid="bank-links-page-loading-spinner"
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
        data-testid="bank-links-org-loading"
      >
        <LoadingDots message={t("loading")} />
      </div>
    );
  }

  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="bank-links-page-main"
    >
      <AppHeader />
      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="bank-links-page-content"
      >
        <DataSourcesProvider
          orgId={org.id}
          filterMode="bank-links"
          translationNamespace="bankLinks"
        >
          <DataSourcesPageInner
            translationNamespace="bankLinks"
            headerIcon={Landmark}
          />
        </DataSourcesProvider>
      </main>
    </div>
  );
}

export default BankLinksPage;
