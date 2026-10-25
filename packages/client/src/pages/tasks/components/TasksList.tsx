"use client";

import { useTranslations } from "next-intl";
import { LoadingDots } from "@zdocs/client-component";
import { useTasksPage } from "../context/TasksPageProvider";
import { TaskCard } from "./TaskCard";

export function TasksList() {
  const t = useTranslations("tasks");
  const { tasks, isLoading, error } = useTasksPage();

  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="tasks-loading"
      >
        <LoadingDots message={t("loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="tasks-error"
      >
        <div className="text-center text-destructive">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="tasks-empty"
      >
        <div className="text-center text-muted-foreground">
          <p>{t("noTasks")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="tasks-list">
      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
