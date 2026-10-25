"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import type {
  Task,
  TaskExecution,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "@zdocs/types";

type TabType = "scheduling" | "code" | "history";

interface SaveHandler {
  getData: () => UpdateTaskRequest;
  validate?: () => boolean;
  onValidationError?: (error: string) => void;
}
import useOrgStore from "../../../context-providers/orgStore";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  fetchTasks,
  fetchTask,
  createTask,
  updateTask,
  deleteTask,
  pauseTask,
  resumeTask,
  fetchTaskExecutions,
} from "../../../utilities/api/fetchTasks";
import { useConfirm } from "../../../context-providers/confirm-provider/ConfirmProvider";
import { useRouter } from "next/navigation";

interface TasksPageContextValue {
  // State
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  isLoadingTask: boolean; // Loading state for single task fetch
  error: string | null;
  isCreateDialogOpen: boolean;
  setIsCreateDialogOpen: (open: boolean) => void;

  // Task executions
  executions: TaskExecution[];
  executionsTotal: number;
  isLoadingExecutions: boolean;

  // Save state
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // Methods
  fetchTasks: () => Promise<void>;
  createTask: (
    name: string,
    description: string | null
  ) => Promise<Task | null>;
  updateTask: (taskId: string, data: UpdateTaskRequest) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  selectTask: (taskId: string | null) => void;
  refreshTask: (taskId: string) => Promise<void>;
  fetchExecutions: (
    taskId: string,
    options?: { limit?: number; offset?: number }
  ) => Promise<void>;

  // Save methods
  registerSaveHandler: (tab: TabType, handler: SaveHandler) => void;
  unregisterSaveHandler: (tab: TabType) => void;
  setDirty: (dirty: boolean) => void;
  handleSave: () => Promise<void>;
}

const TasksPageContext = createContext<TasksPageContextValue | undefined>(
  undefined
);

export function TasksPageProvider({ children }: { children: React.ReactNode }) {
  const { org } = useOrgStore();
  const t = useTranslations("tasks");
  const confirm = useConfirm();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [executionsTotal, setExecutionsTotal] = useState(0);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("scheduling");
  const [saveHandlers, setSaveHandlers] = useState<
    Partial<Record<TabType, SaveHandler>>
  >({});

  const loadTasks = useCallback(async () => {
    if (!org?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const fetchedTasks = await fetchTasks(org.id);
      setTasks(fetchedTasks);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError("Failed to load tasks");
      toast.error(t("error"));
    } finally {
      setIsLoading(false);
    }
  }, [org?.id, t]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Reset unsaved changes when switching tabs or task changes
  useEffect(() => {
    setHasUnsavedChanges(false);
  }, [activeTab, selectedTask?.id]);

  const handleCreateTask = useCallback(
    async (name: string, description: string | null): Promise<Task | null> => {
      if (!org?.id) return null;

      try {
        // Create task with minimal data - defaults will be set
        const taskData: CreateTaskRequest = {
          name: name.trim(),
          description: description?.trim() || null,
          instructions: description?.trim() || name.trim(), // Use description or name as instructions
          frequency: "DAILY",
          hour: 9,
          minute: 0,
          isReminder: false,
          functionCode: null,
          notificationEmails: [],
          // dayOfWeek and dayOfMonth are optional for DAILY frequency
        };

        const newTask = await createTask(org.id, taskData);
        await loadTasks();
        setIsCreateDialogOpen(false);

        // Navigate to task detail page
        router.push(`/tasks/${newTask.id}`);

        return newTask;
      } catch (err) {
        console.error("Failed to create task:", err);
        toast.error(t("createError"));
        return null;
      }
    },
    [org?.id, loadTasks, router, t]
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, data: UpdateTaskRequest): Promise<void> => {
      if (!org?.id) return;

      try {
        const updatedTask = await updateTask(org.id, taskId, data);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t))
        );
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }
        toast.success(t("updateSuccess"));
      } catch (err) {
        console.error("Failed to update task:", err);
        toast.error(t("updateError"));
        throw err;
      }
    },
    [org?.id, selectedTask?.id, t]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!org?.id) return;

      const confirmed = await confirm({
        title: t("deleteConfirmTitle"),
        message: t("deleteConfirmDescription"),
      });

      if (!confirmed) return;

      try {
        await deleteTask(org.id, taskId);
        await loadTasks();
        if (selectedTask?.id === taskId) {
          setSelectedTask(null);
          router.push("/tasks");
        }
        toast.success(t("deleteSuccess"));
      } catch (err) {
        console.error("Failed to delete task:", err);
        toast.error(t("deleteError"));
      }
    },
    [org?.id, loadTasks, selectedTask?.id, router, confirm, t]
  );

  const handlePauseTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!org?.id) return;

      try {
        const updatedTask = await pauseTask(org.id, taskId);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t))
        );
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }
        toast.success(t("pauseSuccess"));
      } catch (err) {
        console.error("Failed to pause task:", err);
        toast.error(t("pauseError"));
      }
    },
    [org?.id, selectedTask?.id, t]
  );

  const handleResumeTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!org?.id) return;

      try {
        const updatedTask = await resumeTask(org.id, taskId);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t))
        );
        if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
        }
        toast.success(t("resumeSuccess"));
      } catch (err) {
        console.error("Failed to resume task:", err);
        toast.error(t("resumeError"));
      }
    },
    [org?.id, selectedTask?.id, t]
  );

  const handleSelectTask = useCallback(
    async (taskId: string | null) => {
      if (!taskId || !org?.id) {
        setSelectedTask(null);
        setIsLoadingTask(false);
        return;
      }

      setIsLoadingTask(true);
      try {
        console.log("[TasksPageProvider] handleSelectTask: fetching task", {
          taskId,
          orgId: org.id,
        });
        const task = await fetchTask(org.id, taskId);
        console.log("[TasksPageProvider] handleSelectTask: task fetched", {
          taskId: task.id,
          hasMessages: !!task.messages,
          messagesCount: task.messages?.length ?? 0,
          messages: task.messages,
        });
        setSelectedTask(task);
      } catch (err) {
        console.error("Failed to fetch task:", err);
        toast.error(t("fetchError"));
        setSelectedTask(null);
      } finally {
        setIsLoadingTask(false);
      }
    },
    [org?.id, t]
  );

  const handleRefreshTask = useCallback(
    async (taskId: string) => {
      if (!org?.id) return;

      try {
        console.log("[TasksPageProvider] handleRefreshTask: refreshing task", {
          taskId,
          orgId: org.id,
        });
        const task = await fetchTask(org.id, taskId);
        console.log("[TasksPageProvider] handleRefreshTask: task refreshed", {
          taskId: task.id,
          hasMessages: !!task.messages,
          messagesCount: task.messages?.length ?? 0,
          messages: task.messages,
          willUpdateSelectedTask: selectedTask?.id === taskId,
        });
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
        if (selectedTask?.id === taskId) {
          setSelectedTask(task);
        }
      } catch (err) {
        console.error("Failed to refresh task:", err);
      }
    },
    [org?.id, selectedTask?.id]
  );

  const handleFetchExecutions = useCallback(
    async (
      taskId: string,
      options?: { limit?: number; offset?: number }
    ): Promise<void> => {
      if (!org?.id) return;

      setIsLoadingExecutions(true);
      try {
        const result = await fetchTaskExecutions(org.id, taskId, options);
        setExecutions(result.executions);
        setExecutionsTotal(result.total);
      } catch (err) {
        console.error("Failed to fetch executions:", err);
        toast.error(t("executionsError"));
      } finally {
        setIsLoadingExecutions(false);
      }
    },
    [org?.id, t]
  );

  const registerSaveHandler = useCallback(
    (tab: TabType, handler: SaveHandler) => {
      setSaveHandlers((prev) => ({
        ...prev,
        [tab]: handler,
      }));
    },
    []
  );

  const unregisterSaveHandler = useCallback((tab: TabType) => {
    setSaveHandlers((prev) => {
      const next = { ...prev };
      delete next[tab];
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedTask) return;

    const handler = saveHandlers[activeTab];
    if (!handler) return;

    // Validate if validator provided
    if (handler.validate && !handler.validate()) {
      if (handler.onValidationError) {
        handler.onValidationError(t("validationError"));
      }
      return;
    }

    setIsSaving(true);
    try {
      const data = handler.getData();
      await handleUpdateTask(selectedTask.id, data);
      setHasUnsavedChanges(false);
    } catch (err) {
      // Error already handled in handleUpdateTask
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [selectedTask, activeTab, saveHandlers, handleUpdateTask, t]);

  const value: TasksPageContextValue = useMemo(
    () => ({
      tasks,
      selectedTask,
      isLoading,
      isLoadingTask,
      error,
      isCreateDialogOpen,
      setIsCreateDialogOpen,
      executions,
      executionsTotal,
      isLoadingExecutions,
      isSaving,
      hasUnsavedChanges,
      activeTab,
      setActiveTab,
      fetchTasks: loadTasks,
      createTask: handleCreateTask,
      updateTask: handleUpdateTask,
      deleteTask: handleDeleteTask,
      pauseTask: handlePauseTask,
      resumeTask: handleResumeTask,
      selectTask: handleSelectTask,
      refreshTask: handleRefreshTask,
      fetchExecutions: handleFetchExecutions,
      registerSaveHandler,
      unregisterSaveHandler,
      setDirty: setHasUnsavedChanges,
      handleSave,
    }),
    [
      tasks,
      selectedTask,
      isLoading,
      isLoadingTask,
      error,
      isCreateDialogOpen,
      executions,
      executionsTotal,
      isLoadingExecutions,
      isSaving,
      hasUnsavedChanges,
      activeTab,
      loadTasks,
      handleCreateTask,
      handleUpdateTask,
      handleDeleteTask,
      handlePauseTask,
      handleResumeTask,
      handleSelectTask,
      handleRefreshTask,
      handleFetchExecutions,
      registerSaveHandler,
      unregisterSaveHandler,
      handleSave,
    ]
  );

  return (
    <TasksPageContext.Provider value={value}>
      {children}
    </TasksPageContext.Provider>
  );
}

export function useTasksPage() {
  const context = useContext(TasksPageContext);
  if (context === undefined) {
    throw new Error("useTasksPage must be used within a TasksPageProvider");
  }
  return context;
}
