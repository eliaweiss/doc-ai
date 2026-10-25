"use client";

/**
 * doc-ai: runs one mini app, view only. In zdocs mini apps open inside the
 * AI builder (/ai-builder/:id?fullscreen=true); doc-ai has no builder, so this
 * page renders just the MiniAppViewer (iframe + uiTx bridge) under the header,
 * with buttons to edit the app's name / icon / color, archive (or restore)
 * and delete it.
 */
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { MiniApp } from "@zdocs/types";
import { LoadingDots } from "@zdocs/client-component";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import { MiniAppViewer } from "../../components/ui-tx/MiniAppViewer";
import useOrgStore from "../../context-providers/orgStore";
import useAppStore from "../../context-providers/appStore";
import { loadMiniAppApi } from "../../utilities/api/miniAppApi";
import { EditMiniAppDialog } from "../ai-builder/components/EditMiniAppDialog";
import { useDeleteMiniApp } from "./useDeleteMiniApp";
import { useArchiveMiniApp } from "./useArchiveMiniApp";

/**
 * Apps built in zdocs load the SDK from the zdocs host
 * (<script src="https://<host>/sdk/ui-tx/v1.js">); serve the local copy instead.
 */
function toLocalSdk(code: string): string {
  return code.replace(
    /(["'])(?:https?:)?\/\/[^"']*?\/sdk\/ui-tx\/v1\.js\1/g,
    "$1/sdk/ui-tx/v1.js$1"
  );
}

export function MiniAppPage({ miniAppId }: { miniAppId: string }) {
  const { status } = useSession();
  const { org } = useOrgStore();
  const { miniApps, updateMiniAppInList } = useAppStore();
  const deleteMiniApp = useDeleteMiniApp();
  const setArchived = useArchiveMiniApp();
  const router = useRouter();
  const [loaded, setLoaded] = useState<MiniApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fromStore = miniApps.find((app) => app.id === miniAppId) ?? null;
  const miniApp = fromStore ?? loaded;

  useEffect(() => {
    if (!org?.id || fromStore) return;
    setError(null);
    loadMiniAppApi(org.id, miniAppId)
      .then(setLoaded)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load app"));
  }, [org?.id, miniAppId, fromStore]);

  const html = toLocalSdk(miniApp?.code ?? "");
  const content = useMemo(() => {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {error}
        </div>
      );
    }
    if (!miniApp) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <LoadingDots message="Loading app..." />
        </div>
      );
    }
    return (
      <MiniAppViewer
        key={miniApp.id}
        html={html}
        title={miniApp.name}
        isFullscreen={isFullscreen}
        onFullscreen={setIsFullscreen}
        onClose={() => router.push("/apps")}
        headerActions={
          <>
            <button
              onClick={() => setIsEditing(true)}
              title="Edit"
              className="p-1 hover:bg-muted rounded"
              data-testid="mini-app-edit-btn"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                const updated = await setArchived(miniApp, !miniApp.archivedAt);
                if (updated) setLoaded(updated);
              }}
              title={miniApp.archivedAt ? "Restore" : "Archive"}
              className="p-1 hover:bg-muted rounded"
              data-testid={miniApp.archivedAt ? "mini-app-unarchive-btn" : "mini-app-archive-btn"}
            >
              {miniApp.archivedAt ? (
                <ArchiveRestore className="w-4 h-4" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={async () => {
                if (await deleteMiniApp(miniApp)) router.push("/apps");
              }}
              title="Delete"
              className="p-1 hover:bg-destructive/10 rounded"
              data-testid="mini-app-delete-btn"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </>
        }
      />
    );
  }, [error, miniApp, html, isFullscreen, router, deleteMiniApp, setArchived]);

  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="mini-app-page"
    >
      {!isFullscreen && <AppHeader />}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {content}
      </main>
      {org?.id && (
        <EditMiniAppDialog
          open={isEditing}
          onOpenChange={setIsEditing}
          miniApp={miniApp}
          orgId={org.id}
          onSuccess={(updated) => {
            updateMiniAppInList(updated);
            setLoaded(updated);
          }}
        />
      )}
    </div>
  );
}

export default MiniAppPage;
