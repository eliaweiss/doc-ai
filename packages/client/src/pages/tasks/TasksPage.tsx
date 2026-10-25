"use client";

import { useSession } from "next-auth/react";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../app/AppAuthView";
import { AppHeader } from "../app/AppHeader";
import useOrgStore from "../../context-providers/orgStore";
import { TasksPageProvider } from "./context/TasksPageProvider";
import { TasksList } from "./components/TasksList";
import { CreateTaskDialog } from "./components/CreateTaskDialog";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Plus } from "lucide-react";
import { useTasksPage } from "./context/TasksPageProvider";

/**
 * Inner component that renders the tasks page content.
 * Must be used within TasksPageProvider context.
 *
 * Renders:
 * - Header with title and "New Task" button
 * - TasksList component showing all tasks
 * - CreateTaskDialog for creating new tasks
 */
function TasksPageInner() {
  const t = useTranslations("tasks");
  const { setIsCreateDialogOpen } = useTasksPage();

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-background"
      data-testid="tasks-page-main"
    >
      <div
        className="border-b border-border px-6 py-4 flex items-center justify-between"
        data-testid="tasks-header"
      >
        <h1
          className="text-2xl font-bold text-foreground"
          data-testid="tasks-title"
        >
          {t("title")}
        </h1>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="new-task-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("newTask")}
        </Button>
      </div>

      <TasksList />
      <CreateTaskDialog />
    </div>
  );
}

/**
 * Main Tasks Page component.
 *
 * Handles authentication, organization loading, and provides the tasks UI.
 *
 * Flow:
 * 1. Checks authentication status - shows loading spinner while checking
 * 2. If unauthenticated - shows AppAuthView (login/register)
 * 3. Waits for organization to load - shows loading message
 * 4. Once authenticated and org loaded - renders the tasks UI
 *
 * Provider Structure:
 * - DriveProvider: Provides drive/folder context for navigation
 * - TasksPageProvider: Provides tasks state, CRUD operations, and save logic
 *
 * The TasksPageProvider manages:
 * - Task list and selected task state
 * - Task CRUD operations (create, update, delete, pause, resume)
 * - Save state for task detail tabs (scheduling, code)
 * - Task execution history
 *
 * @returns The tasks page UI with proper authentication and provider setup
 */
export function TasksPage() {
  const { status } = useSession();
  const { org } = useOrgStore();

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="tasks-page-loading"
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
        data-testid="tasks-org-loading"
      >
        <LoadingDots message="Loading Tasks..." />
      </div>
    );
  }

  // Authenticated - show main app with Tasks layout
  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      data-testid="tasks-page-main"
    >
      <AppHeader />

      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="tasks-page-content"
      >
        <TasksPageProvider>
          <TasksPageInner />
        </TasksPageProvider>
      </main>
    </div>
  );
}

export default TasksPage;
