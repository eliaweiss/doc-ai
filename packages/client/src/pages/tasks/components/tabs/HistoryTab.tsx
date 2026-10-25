"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { LoadingDots } from "@zdocs/client-component";
import { Badge } from "@zdocs/client-component";
import { useTasksPage } from "../../context/TasksPageProvider";
import { formatDate } from "@zdocs/util";

export function HistoryTab() {
  const t = useTranslations("tasks");
  const { selectedTask, fetchExecutions, executions, isLoadingExecutions } =
    useTasksPage();

  // Load executions when tab is mounted
  useEffect(() => {
    if (selectedTask) {
      fetchExecutions(selectedTask.id, { limit: 50, offset: 0 });
    }
  }, [selectedTask, fetchExecutions]);

  if (isLoadingExecutions) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="history-loading">
        <LoadingDots message={t("loadingExecutions")} />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8" data-testid="history-empty">
        {t("noExecutions")}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="history-tab">
      <div className="space-y-2">
        {executions.map((execution) => (
          <div
            key={execution.id}
            className="border border-border rounded-lg p-4"
            data-testid={`execution-${execution.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    execution.status === "SUCCESS"
                      ? "default"
                      : execution.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                  }
                  data-testid={`execution-status-${execution.id}`}
                >
                  {execution.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(execution.startedAt)}
                </span>
                {execution.durationMs && (
                  <span className="text-sm text-muted-foreground">
                    ({execution.durationMs}ms)
                  </span>
                )}
              </div>
            </div>
            {execution.errorMessage && (
              <div
                className="mt-2 text-sm text-destructive"
                data-testid={`execution-error-${execution.id}`}
              >
                {execution.errorMessage}
              </div>
            )}
            {execution.output && (
              <div
                className="mt-2 text-sm text-muted-foreground font-mono whitespace-pre-wrap"
                data-testid={`execution-output-${execution.id}`}
              >
                {execution.output}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
