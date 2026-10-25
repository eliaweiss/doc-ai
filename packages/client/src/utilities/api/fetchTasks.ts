import { zFetch } from "../../lib/utils";
import type {
  Task,
  TaskExecution,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "@zdocs/types";

export interface FetchTasksResponse {
  tasks: Task[];
}

export interface FetchTaskResponse {
  task: Task;
}

export interface FetchTaskExecutionsResponse {
  executions: TaskExecution[];
  total: number;
}

export async function fetchTasks(
  orgId: string,
  status?: "ACTIVE" | "PAUSED"
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (status) {
    params.append("status", status);
  }
  const url = `/api/org/${orgId}/tasks${
    params.toString() ? `?${params.toString()}` : ""
  }`;
  const data = (await zFetch(url, {
    method: "GET",
  })) as FetchTasksResponse;
  return data.tasks;
}

export async function fetchTask(orgId: string, taskId: string): Promise<Task> {
  const data = (await zFetch(`/api/org/${orgId}/tasks/${taskId}`, {
    method: "POST",
  })) as FetchTaskResponse;
  return data.task;
}

export async function createTask(
  orgId: string,
  taskData: CreateTaskRequest
): Promise<Task> {
  const data = (await zFetch(`/api/org/${orgId}/tasks`, {
    method: "POST",
    body: taskData,
  })) as FetchTaskResponse;
  return data.task;
}

export async function updateTask(
  orgId: string,
  taskId: string,
  taskData: UpdateTaskRequest
): Promise<Task> {
  const data = (await zFetch(`/api/org/${orgId}/tasks/${taskId}`, {
    method: "PUT",
    body: taskData,
  })) as FetchTaskResponse;
  return data.task;
}

export async function deleteTask(orgId: string, taskId: string): Promise<void> {
  await zFetch(`/api/org/${orgId}/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function pauseTask(orgId: string, taskId: string): Promise<Task> {
  const data = (await zFetch(`/api/org/${orgId}/tasks/${taskId}/pause`, {
    method: "POST",
  })) as FetchTaskResponse;
  return data.task;
}

export async function resumeTask(orgId: string, taskId: string): Promise<Task> {
  const data = (await zFetch(`/api/org/${orgId}/tasks/${taskId}/resume`, {
    method: "POST",
  })) as FetchTaskResponse;
  return data.task;
}

export async function fetchTaskExecutions(
  orgId: string,
  taskId: string,
  options?: { limit?: number; offset?: number }
): Promise<FetchTaskExecutionsResponse> {
  const data = (await zFetch(`/api/org/${orgId}/tasks/${taskId}/executions`, {
    method: "POST",
    body: options || {},
  })) as FetchTaskExecutionsResponse;
  return data;
}
