"use client";

import { useSession } from "next-auth/react";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { MiniAppProvider, useMiniApp } from "./context/MiniAppProvider";
import { AiBuilderPageInner } from "./components/AiBuilderPageInner";
import { AiBuilderProvider } from "./context/AiBuilderProvider";
import { useSearchParams } from "next/navigation";
import { isMobileWidth } from "@zdocs/util";
import { useEffect, useState } from "react";

export function AiBuilderPage({ miniAppId }: { miniAppId?: string | null }) {
  const { status } = useSession();
  const { org } = useOrgStore();




  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="ai-builder-page-loading"
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
        data-testid="ai-builder-org-loading"
      >
        <LoadingDots message="Loading Mini App..." />
      </div>
    );
  }

  // Authenticated - show main app with AI Builder layout
  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="ai-builder-page-main"
    >
      <AppHeader />

      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="ai-builder-page-content"
      >
        <MiniAppProvider initialMiniAppId={miniAppId}>
          <AiBuilderPageInnerWithProvider />
        </MiniAppProvider>
      </main>
    </div>
  );
}

export function AiBuilderPageInnerWithProvider() {
  const { isLoading } = useMiniApp();
  const isMobile = isMobileWidth();
  const searchParams = useSearchParams();
  const [initialFullscreen, setInitialFullscreen] = useState<boolean>(false);

  // Check URL parameter for fullscreen mode on mount and when URL changes
  useEffect(() => {
    const fullscreenParam = searchParams.get("fullscreen") ? searchParams.get("fullscreen") === "true" : isMobile ? true : false;
    setInitialFullscreen(fullscreenParam);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="ai-builder-org-loading"
      >
        <LoadingDots message="Loading Claude Code..." />
      </div>
    );
  }

  return (
    <AiBuilderProvider initialFullscreen={initialFullscreen}>
      <AiBuilderPageInner />
    </AiBuilderProvider>
  );
}

export default AiBuilderPage;
