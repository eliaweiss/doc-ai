// Queue job status enum values (runtime array for Drizzle)
export const QUEUE_JOB_STATUSES = [
  "PENDING", // Waiting to be processed
  "IN_PROGRESS", // Currently being processed
  "COMPLETED", // Successfully completed
  "FAILED", // Failed after max retries
  "TIMEOUT", // Worker timed out
  "CANCELLED", // Job cancelled (e.g., document deleted)
  "KEY_ERROR", // API key error - will retry when key is fixed
  "INSUFFICIENT_CREDITS", // Waiting for credits - retries like PENDING without incrementing attempts
] as const;

export type QueueJobStatus = (typeof QUEUE_JOB_STATUSES)[number];

// Queue job action enum values (runtime array for Drizzle)
// Represents what processing step to perform next
export const QUEUE_JOB_ACTIONS = [
  "CLASSIFY", // Classification stage (then moves to EXTRACT)
  "EXTRACT", // Extraction stage (final step)
] as const;

export type QueueJobAction = (typeof QUEUE_JOB_ACTIONS)[number];

// Queue job interface
export interface QueueJob {
  id: string;
  orgId: string;
  documentId: string;
  action: QueueJobAction; // Current action to perform
  status: QueueJobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  retryAfter: Date | null;
  priority: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}
