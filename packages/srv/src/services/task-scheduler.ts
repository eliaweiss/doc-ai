/**
 * doc-ai: retries are picked up by the in-process worker loop
 * (apps/server/src/worker.ts), so there is nothing to schedule.
 */
export async function scheduleQueueRetry(_delayMinutes: number): Promise<void> {}
