"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Clock,
  Code,
  History,
  Pause,
  Play,
  Trash2,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@zdocs/client-component";
import { Badge } from "@zdocs/client-component";
import { LoadingDots } from "@zdocs/client-component";
import { EditableField } from "../../document/components/EditableField";
import { useTasksPage } from "../context/TasksPageProvider";
import { useConfirm } from "../../../context-providers/confirm-provider/ConfirmProvider";
import { SchedulingTab } from "./tabs/SchedulingTab";
import { CodeTab } from "./tabs/CodeTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { cn, isMobileWidth } from "@zdocs/util";

type TabType = "scheduling" | "code" | "history";

export function TaskDetail() {
  const isMobile = isMobileWidth();
  const t = useTranslations("tasks");
  const router = useRouter();
  const confirm = useConfirm();
  const {
    selectedTask,
    isLoadingTask,
    deleteTask,
    pauseTask,
    resumeTask,
    updateTask,
    isSaving,
    hasUnsavedChanges,
    activeTab,
    setActiveTab,
    handleSave,
  } = useTasksPage();

  const handleTabChange = async (newTab: TabType) => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: t("unsavedChangesTitle"),
        message: t("unsavedChangesDescription"),
      });
      if (!confirmed) return;
    }
    setActiveTab(newTab);
  };

  const handleBackClick = async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: t("unsavedChangesTitle"),
        message: t("unsavedChangesDescription"),
      });
      if (!confirmed) return;
    }
    router.push("/tasks");
  };

  if (isLoadingTask) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="task-detail-loading"
      >
        <LoadingDots message={t("loading")} />
      </div>
    );
  }

  if (!selectedTask) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8"
        data-testid="task-detail-empty"
      >
        <Clock className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">{t("noTaskSelected")}</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      data-testid="task-detail"
    >
      {/* Header */}
      <div
        className={cn(
          "border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex flex-col",
          "sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0")}
        data-testid="task-detail-header"
      >
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
            className="shrink-0"
            data-testid="task-detail-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <EditableField
              value={selectedTask.name}
              onChange={async (newName) => {
                if (newName.trim() && newName !== selectedTask.name) {
                  try {
                    await updateTask(selectedTask.id, { name: newName.trim() });
                  } catch (error) {
                    console.error("Failed to update task name:", error);
                  }
                }
              }}
              className="text-base sm:text-2xl font-bold text-foreground"
              inputClassName="text-base sm:text-2xl font-bold"
              type="text"
              data-testid="task-detail-name"
            />
            {selectedTask.description && (
              <p
                className="text-muted-foreground mt-1 truncate"
                data-testid="task-detail-description"
              >
                {selectedTask.description}
              </p>
            )}
          </div>
        </div>
        <div className={cn("flex items-center gap-2 flex-wrap sm:flex-nowrap sm:ml-4 justify-end")}
          data-testid="task-detail-actions">
          {activeTab !== "history" && (
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
              className="sm:size-default"
              data-testid="save-task-btn"
            >
              <Save className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{isSaving ? t("saving") : t("save")}</span>
            </Button>
          )}
          <button
            onClick={() => {
              if (selectedTask.status === "ACTIVE") {
                pauseTask(selectedTask.id);
              } else {
                resumeTask(selectedTask.id);
              }
            }}
            className="shrink-0"
            data-testid="task-detail-pause-resume-btn"
          >
            <Badge
              variant={selectedTask.status === "ACTIVE" ? "default" : "secondary"}
              className={cn("h-8", selectedTask.status === "ACTIVE" ? "bg-green-500" : "bg-secondary text-secondary-foreground")}
              data-testid="task-detail-status"
            >
              {selectedTask.status === "ACTIVE" ? t("active") : t("paused")}

              {selectedTask.status === "ACTIVE" ? (
                <>
                  <Pause className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("pause")}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("resume")}</span>
                </>
              )}
            </Badge>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteTask(selectedTask.id)}
            className="shrink-0"
            data-testid="task-detail-delete-btn"
          >
            <Trash2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("delete")}</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border" data-testid="task-detail-tabs">
        <div className="flex">
          <button
            onClick={() => handleTabChange("scheduling")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "scheduling"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            data-testid="tab-scheduling"
          >
            <Clock className="w-4 h-4" />
            {t("scheduling")}
          </button>
          {!isMobile && (
            <button
              onClick={() => handleTabChange("code")}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "code"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              data-testid="tab-code"
            >
              <Code className="w-4 h-4" />
              {t("codeEdit")}
            </button>
          )}
          <button
            onClick={() => handleTabChange("history")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            data-testid="tab-history"
          >
            <History className="w-4 h-4" />
            {t("runHistory")}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div
        className="flex-1 overflow-y-auto p-6"
        data-testid="task-detail-content"
      >
        {activeTab === "scheduling" && <SchedulingTab />}
        {activeTab === "code" && <CodeTab />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
