"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clock, Play, Pause } from "lucide-react";
import type { Task } from "@zdocs/types";
import { formatSchedule } from "@zdocs/util";
import { formatDate } from "@zdocs/util";
import { Badge } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { useTasksPage } from "../context/TasksPageProvider";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const { pauseTask, resumeTask } = useTasksPage();

  const scheduleText = formatSchedule(
    task.frequency,
    task.dayOfWeek,
    task.dayOfMonth,
    task.hour,
    task.minute
  );

  const handleClick = () => {
    router.push(`/tasks/${task.id}`);
  };

  const handlePauseResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === "ACTIVE") {
      await pauseTask(task.id);
    } else {
      await resumeTask(task.id);
    }
  };

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={handleClick}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <h3 className="font-semibold text-foreground truncate" data-testid={`task-name-${task.id}`}>
              {task.name}
            </h3>
          </div>
          
          {task.description && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2" data-testid={`task-description-${task.id}`}>
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span data-testid={`task-schedule-${task.id}`}>{scheduleText}</span>
            {task.lastRunAt && (
              <span data-testid={`task-last-run-${task.id}`}>
                {t("lastRun")}: {formatDate(task.lastRunAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
          <Badge
            variant={task.status === "ACTIVE" ? "default" : "secondary"}
            data-testid={`task-status-${task.id}`}
          >
            {task.status === "ACTIVE" ? t("active") : t("paused")}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePauseResume}
            data-testid={`task-pause-resume-${task.id}`}
          >
            {task.status === "ACTIVE" ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
