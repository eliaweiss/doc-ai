import { eq, sql } from "drizzle-orm";
import { zdocsDb } from "../db";
import { processLockTbl } from "../schemas/process-locks";
import type { ProcessLockId } from "@zdocs/types";

/**
 * Acquire a process lock to prevent concurrent daemon execution.
 *
 * If the lock is not set, sets it.
 * If the lock is set but expired (older than `minutes`), takes over the lock.
 * If the lock is set and not expired, returns false.
 *
 * @param processId - The process lock ID (from PROCESS_LOCK_IDS)
 * @param minutes - Lock timeout in minutes (default: 10)
 * @returns true if lock was acquired, false if daemon is already running
 */
export async function acquireLock(
  processId: ProcessLockId,
  minutes: number = 10
): Promise<boolean> {
  const now = new Date();
  const timeout = new Date(now.getTime() - minutes * 60 * 1000);

  // Ensure the lock row exists (upsert)
  await zdocsDb
    .insert(processLockTbl)
    .values({
      id: processId,
      lockFlag: false,
      lastAcquired: null,
    })
    .onConflictDoNothing();

  // Try to acquire lock:
  // - Either lockFlag is false (not locked)
  // - Or lastAcquired is older than timeout (stuck/crashed daemon)
  const result = await zdocsDb
    .update(processLockTbl)
    .set({
      lockFlag: true,
      lastAcquired: now,
    })
    .where(
      sql`${processLockTbl.id} = ${processId} AND (
        ${processLockTbl.lockFlag} = false
        OR ${processLockTbl.lastAcquired} < ${timeout.toISOString()}
        OR ${processLockTbl.lastAcquired} IS NULL
      )`
    )
    .returning({ id: processLockTbl.id });

  return result.length > 0;
}

/**
 * Update the process lock timestamp to prevent timeout.
 *
 * Call this periodically during long-running processes to indicate
 * the daemon is still alive and working.
 *
 * @param processId - The process lock ID
 */
export async function updateProcessLock(
  processId: ProcessLockId
): Promise<void> {
  const now = new Date();

  try {
    const result = await zdocsDb
      .update(processLockTbl)
      .set({ lastAcquired: now })
      .where(eq(processLockTbl.id, processId))
      .returning({ id: processLockTbl.id });

    if (result.length > 0) {
      console.log(
        `[ProcessLock] Updated lock timestamp to ${now.toISOString()} for process ${processId}`
      );
    } else {
      console.log(
        `[ProcessLock] Failed to update lock for process ${processId}. Lock not found.`
      );
    }
  } catch (error) {
    console.error("[ProcessLock] Error updating process lock:", error);
  }
}

/**
 * Release the process lock when daemon completes.
 *
 * @param processId - The process lock ID
 */
export async function releaseLock(processId: ProcessLockId): Promise<void> {
  await zdocsDb
    .update(processLockTbl)
    .set({ lockFlag: false })
    .where(eq(processLockTbl.id, processId));

  console.log(`[ProcessLock] Released lock for process ${processId}`);
}

/**
 * Check if a process lock is currently held.
 *
 * @param processId - The process lock ID
 * @param minutes - Lock timeout in minutes
 * @returns true if lock is held and not expired
 */
export async function isLockHeld(
  processId: ProcessLockId,
  minutes: number = 10
): Promise<boolean> {
  const timeout = new Date(Date.now() - minutes * 60 * 1000);

  const result = await zdocsDb
    .select()
    .from(processLockTbl)
    .where(eq(processLockTbl.id, processId))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  const lock = result[0];
  if (!lock.lockFlag) {
    return false;
  }

  // Check if lock has expired
  if (lock.lastAcquired && lock.lastAcquired < timeout) {
    return false; // Lock expired
  }

  return true;
}
