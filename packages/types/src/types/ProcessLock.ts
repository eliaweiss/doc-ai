// Process lock IDs for different daemons
export const PROCESS_LOCK_IDS = {
  AI_PROCESSING_DAEMON: 1,
  INDEXING_DAEMON: 2,
  TASK_PROCESSING_DAEMON: 3,
  STALE_PAYMENT_RECONCILIATION: 4,
} as const;

export type ProcessLockId =
  (typeof PROCESS_LOCK_IDS)[keyof typeof PROCESS_LOCK_IDS];

export interface ProcessLock {
  id: number;
  lockFlag: boolean;
  lastAcquired: Date | null;
  createdAt: Date;
}
