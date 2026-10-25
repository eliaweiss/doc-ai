"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import DriveProvider from "../../context-providers/DriveProvider";
import useOrgStore from "../../context-providers/orgStore";
import { TasksPageProvider, useTasksPage } from "./context/TasksPageProvider";
import { TaskDetail } from "./components/TaskDetail";

function TaskDetailPageInner() {
  const params = useParams();
  const taskId = params.taskId as string;
  const { selectTask } = useTasksPage();

  useEffect(() => {
    if (taskId) {
      selectTask(taskId);
    }
  }, [taskId, selectTask]);

  return <TaskDetail />;
}

export function TaskDetailPage() {
  const { status } = useSession();
  const { org } = useOrgStore();

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="task-detail-page-loading"
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
        data-testid="task-detail-org-loading"
      >
        <LoadingDots message="Loading Tasks..." />
      </div>
    );
  }

  // Authenticated - show main app with Task Detail layout
  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="task-detail-page-main"
    >
      <AppHeader />

      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="task-detail-page-content"
      >
        <TasksPageProvider>
          <TaskDetailPageInner />
        </TasksPageProvider>
      </main>
    </div>
  );
}

export default TaskDetailPage;
