import { useState } from "react";
import { Menu, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { LoadingDots } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { useAiBuilder } from "../context/AiBuilderProvider";
import { useMiniApp } from "../context/MiniAppProvider";
import { MiniAppsSidebar } from "./MiniAppsSidebar";
import { AiBuilderContent } from "./AiBuilderContent";
import { CreateMiniAppDialog } from "./CreateMiniAppDialog";

export function AiBuilderPageInner() {
  const { isFullscreen } = useAiBuilder();
  const { miniApp, isLoading, error } = useMiniApp();

  const [showSidebar, setShowSidebar] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const t = useTranslations("aiBuilder");


  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="ai-builder-loading"
      >
        <LoadingDots message={t("loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="ai-builder-error"
      >
        <div
          className="text-center text-destructive"
          data-testid="error-message"
        >
          <p>{error}</p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="mt-4"
            data-testid="start-new-miniapp-error-button"
          >
            {t("createMiniApp")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar - hidden when in fullscreen */}
      {!isFullscreen && (
        <div
          className={`border-r border-border flex flex-col transition-all duration-200 ${showSidebar ? "w-[280px]" : "w-[50px]"
            }`}
          data-testid="ai-builder-sidebar"
        >
          <div className="flex justify-between items-center p-4 border-b border-border">
            {showSidebar && (
              <h2 className="text-lg font-semibold text-foreground">{t("miniApps")}</h2>
            )}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1 hover:bg-accent rounded transition-colors"
              data-testid="toggle-sidebar-btn"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          {showSidebar && (
            <div className="flex-1 overflow-y-auto p-4">
              <MiniAppsSidebar />
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {miniApp ? (
            <AiBuilderContent />
        ) : (
          <div
            className="flex-1 flex items-center justify-center"
            data-testid="ai-builder-empty-state"
          >
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                {t("noMiniAppSelected")}
              </h2>
              <p className="text-muted-foreground">{t("noMiniAppSelectedDescription")}</p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="lg"
                data-testid="create-miniapp-empty-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("createMiniApp")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateMiniAppDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
