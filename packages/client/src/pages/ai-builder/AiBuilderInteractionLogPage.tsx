"use client";

import { useSession } from "next-auth/react";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { MiniAppProvider, useMiniApp } from "./context/MiniAppProvider";
import { AiBuilderInteractionLog } from "./components/AiBuilderInteractionLog";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { useRouter } from "next/navigation";
import { useRef } from "react";

function AiBuilderInteractionLogPageInner() {
  const router = useRouter();
  const { miniApp, isLoading, error } = useMiniApp();
  const refetchRef = useRef<(() => Promise<void>) | null>(null);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingDots message="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!miniApp) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Mini App not found
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            Interaction Log
          </h1>
          <p className="text-sm text-muted-foreground">{miniApp.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetchRef.current?.()}
          className="shrink-0"
          title="Refresh logs"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <AiBuilderInteractionLog
            autoLoad={true}
            onRefetchReady={(refetch) => {
              refetchRef.current = refetch;
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function AiBuilderInteractionLogPage({
  miniAppId,
}: {
  miniAppId?: string | null;
}) {
  const { status } = useSession();
  const { org } = useOrgStore();

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="ai-builder-log-page-loading"
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
        data-testid="ai-builder-log-org-loading"
      >
        <LoadingDots message="Loading..." />
      </div>
    );
  }

  // Authenticated - show main app with AI Builder layout
  return (
      <div
        className="h-screen bg-background flex flex-col overflow-hidden"
        data-testid="ai-builder-log-page-main"
      >
        <AppHeader />

        <main
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
          data-testid="ai-builder-log-page-content"
        >
          <MiniAppProvider initialMiniAppId={miniAppId}>
            <AiBuilderInteractionLogPageInner />
          </MiniAppProvider>
        </main>
      </div>
  );
}

export default AiBuilderInteractionLogPage;
