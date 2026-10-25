/**
 * Task Types
 *
 * Tasks are recurring scheduled operations that can:
 * - Send email reminders (if is_reminder = true)
 * - Execute code functions (if function_code is not null)
 * - Both (reminder + code execution)
 */

import type { UIMessage } from "ai";

export const TASK_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type TaskFrequency = (typeof TASK_FREQUENCIES)[number];

export const TASK_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_EXECUTION_STATUSES = [
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "SKIPPED",
] as const;
export type TaskExecutionStatus = (typeof TASK_EXECUTION_STATUSES)[number];

/**
 * Task record from database
 */
export interface Task {
  id: string;
  orgId: string;
  userId: string; // Creator/owner

  // Task Definition
  name: string;
  description: string | null;
  instructions: string;
  isReminder: boolean;
  functionCode: string | null;
  functionVersion: number;

  // Schedule Configuration
  frequency: TaskFrequency;
  dayOfWeek: number | null; // 0-6 (Sunday=0) for WEEKLY
  dayOfMonth: number | null; // 1-31 for MONTHLY
  hour: number; // 0-23
  minute: number; // 0-59

  // Notification Configuration
  notificationEmails: string[]; // Array of emails from organizations.sharedWithEmails

  // Execution State
  status: TaskStatus;
  lastRunAt: Date | null;
  nextRunAt: Date;
  runCount: number;
  errorCount: number;
  consecutiveFailureCount: number;

  // AI Chat History
  messages: UIMessage[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Task execution record from database
 */
export interface TaskExecution {
  id: string;
  orgId: string;
  taskId: string;

  // Execution Details
  status: TaskExecutionStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;

  // Results
  output: string | null;
  outputData: Record<string, unknown> | null;
  errorMessage: string | null;
  errorStack: string | null;

  // Metadata
  functionVersion: number;
  createdAt: Date;
}

/**
 * Create task request payload
 */
export interface CreateTaskRequest {
  name: string;
  description?: string | null;
  instructions: string;
  isReminder?: boolean;
  functionCode?: string | null;
  frequency: TaskFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hour: number;
  minute: number;
  notificationEmails?: string[];
}

/**
 * Update task request payload (all fields optional)
 */
export interface UpdateTaskRequest {
  name?: string;
  description?: string | null;
  instructions?: string;
  isReminder?: boolean;
  functionCode?: string | null;
  frequency?: TaskFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hour?: number;
  minute?: number;
  notificationEmails?: string[];
  status?: TaskStatus;
  messages?: UIMessage[];
}

/**
 * Task history record (snapshot of task code at save time)
 */
export interface TaskHistory {
  id: string;
  taskId: string;
  orgId: string;
  userId: string;
  functionCode: string;
  functionVersion: number;
  createdAt: Date;
}
