import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Code, Eye, Save, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { useAiBuilder } from "../context/AiBuilderProvider";
import { useMiniApp } from "../context/MiniAppProvider";
import {
  updateMiniAppApi,
  fetchMiniAppHistoryApi,
} from "../../../utilities/api/miniAppApi";
import type { MiniAppHistory } from "@zdocs/types";
import { formatDate, formatDistanceToNow } from "@zdocs/util";

type ViewMode = "preview" | "code";

interface MiniAppPreviewToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function MiniAppPreviewToolbar({
  viewMode,
  onViewModeChange,
}: MiniAppPreviewToolbarProps) {
  const { miniAppCode, setMiniAppCode, orgId } = useAiBuilder();
  const { miniApp, loadMiniApp } = useMiniApp();
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<MiniAppHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null
  );
  const t = useTranslations("aiBuilder");

  // Fetch history when miniApp changes
  useEffect(() => {
    if (!miniApp?.id || !orgId) {
      setHistory([]);
      setSelectedHistoryId(null);
      return;
    }

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const historyData = await fetchMiniAppHistoryApi(orgId, miniApp.id);
        const historyArray = Array.isArray(historyData) ? historyData : [];
        setHistory(historyArray);
        setSelectedHistoryId(null);
      } catch (error) {
        console.error("Failed to load history:", error);
        toast.error(t("historyLoadFailed"));
        setHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniApp?.id, orgId]);

  const handleSave = async () => {
    if (!miniApp?.id || !orgId || !miniAppCode) return;

    setIsSaving(true);
    try {
      await updateMiniAppApi(orgId, miniApp.id, { code: miniAppCode });
      toast.success(t("codeSaved"));
      onViewModeChange("preview");
      setSelectedHistoryId(null);
      const historyData = await fetchMiniAppHistoryApi(orgId, miniApp.id);
      setHistory(historyData);
    } catch (error) {
      console.error("Failed to save code:", error);
      toast.error(t("codeSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleHistorySelect = (historyId: string) => {
    if (historyId === "current") {
      setSelectedHistoryId(null);
      if (miniApp?.code) {
        setMiniAppCode(miniApp.code);
      }
      return;
    }

    const selectedHistory = history.find((h) => h.id === historyId);
    if (selectedHistory) {
      setSelectedHistoryId(historyId);
      setMiniAppCode(selectedHistory.code);
    }
  };

  const handleRestore = async () => {
    if (!selectedHistoryId || !miniApp?.id || !orgId) return;

    const selectedHistory = history.find((h) => h.id === selectedHistoryId);
    if (!selectedHistory) return;

    setIsSaving(true);
    try {
      await updateMiniAppApi(orgId, miniApp.id, {
        code: selectedHistory.code,
        name: selectedHistory.name,
        description: selectedHistory.description,
        isPublished: selectedHistory.isPublished,
      });
      toast.success(t("historyRestoredAndSaved"));
      setSelectedHistoryId(null);
      await loadMiniApp(miniApp.id);
      const historyData = await fetchMiniAppHistoryApi(orgId, miniApp.id);
      setHistory(historyData);
    } catch (error) {
      console.error("Failed to restore history:", error);
      toast.error(t("historyRestoreFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-2 border-b border-border">
      <div className="flex items-center gap-2 flex-1">
        <Button
          variant={viewMode === "preview" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("preview")}
          className="flex items-center gap-2"
          data-testid="preview-mode-btn"
        >
          <Eye className="w-4 h-4" />
          {t("preview")}
        </Button>
        <Button
          variant={viewMode === "code" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("code")}
          className="flex items-center gap-2"
          data-testid="code-mode-btn"
        >
          <Code className="w-4 h-4" />
          {t("code")}
        </Button>

        {/* History Selector */}
        {history.length > 0 && !isLoadingHistory && (
          <div className="flex items-center gap-2 ml-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <Select
              value={selectedHistoryId || "current"}
              onValueChange={handleHistorySelect}
              disabled={isLoadingHistory}
            >
              <SelectTrigger
                className="w-[200px]"
                data-testid="history-selector"
              >
                <SelectValue placeholder={t("selectHistory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current" data-testid="history-current">
                  {t("currentVersion")}
                </SelectItem>
                {history.map((h) => (
                  <SelectItem
                    key={h.id}
                    value={h.id}
                    data-testid={`history-${h.id}`}
                  >
                    {formatDate(h.createdAt)} (
                    {formatDistanceToNow(h.createdAt, { addSuffix: true })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHistoryId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={isSaving}
                className="flex items-center gap-2"
                data-testid="restore-history-btn"
              >
                {t("restore")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Save Button - only show in code mode */}
      {viewMode === "code" && (
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !miniApp?.id}
          className="flex items-center gap-2"
          data-testid="save-code-btn"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t("saving") : t("saveCode")}
        </Button>
      )}
    </div>
  );
}
