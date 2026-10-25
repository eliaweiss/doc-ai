import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@zdocs/client-component";
import { MiniAppViewer, type ConsoleLog } from "../../../components/ui-tx/MiniAppViewer";
import { MiniAppConsole } from "./MiniAppConsole";
import { MiniAppPreviewToolbar } from "./MiniAppPreviewToolbar";
import { useAiBuilder } from "../context/AiBuilderProvider";
import { useMiniApp } from "../context/MiniAppProvider";
import { isMobileWidth } from "@zdocs/util";

type ViewMode = "preview" | "code";

export function MiniAppPreviewPane() {
  const { isFullscreen, setIsFullscreen } = useAiBuilder();
  const isMobile = isMobileWidth();
  const { miniAppCode, setMiniAppCode } = useAiBuilder();
  const { miniApp } = useMiniApp();
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const t = useTranslations("aiBuilder");

  // Clear console logs when code changes
  useEffect(() => {
    setConsoleLogs([]);
  }, [miniAppCode]);

  if (!miniAppCode) {
    return (
      <div
        className="flex-1 flex items-center justify-center bg-muted/50"
        data-testid="mini-app-preview-empty"
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">{t("noMiniAppCode")}</p>
          <p className="text-sm">{t("noMiniAppCodeDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 h-full flex flex-col"
      data-testid="mini-app-preview-pane"
    >
      {/* View Mode Toggle */}
      {!isMobile && (
        <MiniAppPreviewToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === "preview" ? (
          <div className="flex-1 flex flex-col overflow-hidden" data-testid="preview-content">
            <div className="flex-1 overflow-hidden">
              <MiniAppViewer
                html={miniAppCode}
                title={miniApp?.name || "Mini App Preview"}
                isFullscreen={isFullscreen}
                onFullscreen={setIsFullscreen}
                onLog={(log) => {
                  setConsoleLogs((prev) => [...prev, log]);
                }}
              />
            </div>
            {!isMobile && (
              <div className="border-t border-border p-2">
                <MiniAppConsole
                  logs={consoleLogs}
                  onClear={() => setConsoleLogs([])}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            className="h-full flex flex-col bg-background"
            data-testid="code-content"
          >
            <CodeEditor
              value={miniAppCode}
              onChange={setMiniAppCode}
              language="html"
              placeholder={t("codeEditorPlaceholder")}
              className="flex-1"
              data-testid="code-editor"
            />
          </div>
        )}
      </div>
    </div>
  );
}
