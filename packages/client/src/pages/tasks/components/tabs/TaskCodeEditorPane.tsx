import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { History, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { CodeEditor } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { useTaskCodeChat } from "../../context/TaskCodeChatProvider";
import { useTasksPage } from "../../context/TasksPageProvider";
import { TaskConsole } from "./TaskConsole";
import useOrgStore from "../../../../context-providers/orgStore";
import { zFetch } from "../../../../lib/utils";
import { toast } from "sonner";
import { formatDate, formatDistanceToNow } from "@zdocs/util";
import { Play } from "lucide-react";
import type { TaskHistory } from "@zdocs/types";

interface TaskCodeEditorPaneProps {
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function TaskCodeEditorPane({
  onFullscreenChange,
}: TaskCodeEditorPaneProps) {
  const { taskCode, setTaskCode } = useTaskCodeChat();
  const {
    selectedTask,
    handleSave,
    isSaving,
    hasUnsavedChanges,
    registerSaveHandler,
    unregisterSaveHandler,
    setDirty,
  } = useTasksPage();
  const { org } = useOrgStore();
  const t = useTranslations("tasks");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    output: string | null;
    outputData: Record<string, unknown> | null;
    error: string | null;
  } | null>(null);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null
  );

  // Track dirty state
  useEffect(() => {
    if (!selectedTask) return;
    const isDirty = taskCode !== (selectedTask.functionCode || "");
    setDirty(isDirty);
  }, [selectedTask, taskCode, setDirty]);

  // Register save handler with provider
  useEffect(() => {
    registerSaveHandler("code", {
      getData: () => ({
        functionCode: taskCode || null,
      }),
    });

    return () => {
      unregisterSaveHandler("code");
    };
  }, [taskCode, registerSaveHandler, unregisterSaveHandler]);

  // Fetch history when task changes
  useEffect(() => {
    if (!selectedTask?.id || !org?.id) {
      setHistory([]);
      setSelectedHistoryId(null);
      return;
    }

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await zFetch(
          `/api/org/${org.id}/tasks/${selectedTask.id}/history`,
          {
            method: "POST",
          }
        );
        const historyData = response.history || [];
        const historyArray = Array.isArray(historyData) ? historyData : [];
        setHistory(historyArray);
        setSelectedHistoryId(null);
      } catch (error) {
        console.error("Failed to load history:", error);
        toast.error(t("historyLoadFailed") || "Failed to load history");
        setHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.id, org?.id]);

  const handleFullscreen = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    onFullscreenChange?.(newFullscreenState);
  };

  const handleHistorySelect = (historyId: string) => {
    if (historyId === "current") {
      setSelectedHistoryId(null);
      if (selectedTask?.functionCode) {
        setTaskCode(selectedTask.functionCode);
      }
      return;
    }

    const selectedHistory = history.find((h) => h.id === historyId);
    if (selectedHistory) {
      setSelectedHistoryId(historyId);
      setTaskCode(selectedHistory.functionCode);
    }
  };

  const handleRestore = async () => {
    if (!selectedHistoryId || !selectedTask?.id || !org?.id) return;

    const selectedHistory = history.find((h) => h.id === selectedHistoryId);
    if (!selectedHistory) return;

    try {
      await zFetch(`/api/org/${org.id}/tasks/${selectedTask.id}`, {
        method: "PUT",
        body: {
          functionCode: selectedHistory.functionCode,
        },
      });
      toast.success(t("historyRestoredAndSaved") || "History restored and saved");
      setSelectedHistoryId(null);
      // Reload history to show new entry
      const response = await zFetch(
        `/api/org/${org.id}/tasks/${selectedTask.id}/history`,
        { method: "POST" }
      );
      setHistory(response.history || []);
    } catch (error) {
      console.error("Failed to restore history:", error);
      toast.error(t("historyRestoreFailed") || "Failed to restore history");
    }
  };

  const handleExecute = async () => {
    if (!selectedTask || !org?.id) {
      toast.error(t("noTaskSelected") || "No task selected");
      return;
    }

    if (!taskCode || taskCode.trim() === "") {
      toast.error(t("noCodeToExecute") || "No code to execute");
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      // Auto-save before executing if there are unsaved changes
      if (hasUnsavedChanges) {
        await handleSave();
      }
      const result = await zFetch(
        `/api/org/${org.id}/tasks/${selectedTask.id}/test-execute`,
        {
          method: "POST",
          body: {
            functionCode: taskCode,
          },
        }
      );

      setExecutionResult({
        output: result.output || null,
        outputData: result.outputData || null,
        error: result.error || null,
      });

      if (result.error) {
        toast.error(t("executionFailed") || "Execution failed");
      } else {
        toast.success(t("executionSuccess") || "Execution completed");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setExecutionResult({
        output: null,
        outputData: null,
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClearConsole = () => {
    setExecutionResult(null);
  };

  // Don't show empty state - allow user to write code directly or via AI
  // The empty state was blocking the code editor from being shown

  return (
    <div
      className="flex-1 h-full flex flex-col"
      data-testid="task-code-editor-pane"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-medium text-foreground">
            {selectedTask?.name || t("codeEditor") || "Code Editor"}
          </span>

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
                  data-testid="task-history-selector"
                >
                  <SelectValue
                    placeholder={t("selectHistory") || "Select history"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current" data-testid="task-history-current">
                    {t("currentVersion") || "Current Version"}
                  </SelectItem>
                  {history.map((h) => (
                    <SelectItem
                      key={h.id}
                      value={h.id}
                      data-testid={`task-history-${h.id}`}
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
                  data-testid="restore-task-history-btn"
                >
                  {t("restore") || "Restore"}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Execute Button */}
          <Button
            onClick={handleExecute}
            disabled={isExecuting || isSaving || !taskCode || !selectedTask}
            size="sm"
            className="flex items-center gap-2"
            data-testid="execute-code-btn"
          >
            <Play className="w-4 h-4" />
            {isSaving
              ? t("saving") || "Saving..."
              : isExecuting
              ? t("executing") || "Executing..."
              : t("execute") || "Execute"}
          </Button>

          {/* Fullscreen Button */}
          <button
            onClick={handleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="p-1 hover:bg-muted rounded"
            data-testid="task-code-fullscreen-btn"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Code Editor Section */}
        <div className="flex flex-col gap-2 flex-1 min-h-0 p-4">
          <div className="flex-1 min-h-0 border border-border rounded-md overflow-hidden">
            <CodeEditor
              value={taskCode || ""}
              onChange={setTaskCode}
              language="typescript"
              placeholder={t("codePlaceholder")}
              className="h-full"
              data-testid="code-editor"
            />
          </div>
        </div>

        {/* Console Output Section */}
        <div className="flex flex-col gap-2 flex-shrink-0 p-4 pt-0">
          <TaskConsole
            output={executionResult?.output || null}
            outputData={executionResult?.outputData || null}
            error={executionResult?.error || null}
            isExecuting={isExecuting}
            onClear={handleClearConsole}
          />
        </div>
      </div>
    </div>
  );
}
