import { eq, and, or, lte, isNull, desc, asc, lt } from "drizzle-orm";
import { zdocsDb } from "../db";
import { aiProcessingQueueTbl } from "../schemas/ai";
import { organizationsTbl } from "../schemas/organizations";
import type { QueueJobAction, QueueJob } from "@zdocs/types";
import { setDocumentExtractionFailed } from "./documents";

function actionToStage(action: QueueJobAction): "classification" | "extraction" {
  return action === "CLASSIFY" ? "classification" : "extraction";
}

/**
 * Default configuration for queue processing
 */
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TIMEOUT_MINUTES = 5;
const DEFAULT_RATE_LIMIT_BACKOFF_SECONDS = 30;

/**
 * Enqueue a document for processing
 */
export async function enqueueDocument(
  orgId: string,
  documentId: string,
  action: QueueJobAction,
  priority: number = 0
): Promise<QueueJob> {
  const result = await zdocsDb
    .insert(aiProcessingQueueTbl)
    .values({
      orgId,
      documentId,
      action,
      priority,
      status: "PENDING",
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    })
    .returning();

  // Fire-and-forget: trigger processing immediately based on action
  // The daemon will only kick in for retries, timeouts, or batch API uploads
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (baseUrl) {
    const job = result[0];
    let endpoint = "";
    if (action === "CLASSIFY") {
      endpoint = `${baseUrl}/api/org/${orgId}/documents/${documentId}/classify`;
    } else {
      endpoint = `${baseUrl}/api/org/${orgId}/documents/${documentId}/extract`;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((error) => {
      console.error(`[Queue] Failed to trigger immediate processing:`, error);
      // Job is in queue, daemon will pick it up on next cycle
    });
    console.log("triggered immediate processing", endpoint);
    
    // Sleep for 1 second to give the fire-and-forget request time to start
    // This ensures the serverless function begins processing before the API response returns
    // The daemon will still pick up the job if the fire-and-forget fails
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return result[0];
}

/**
 * Check if a document already has a pending or in-progress job
 */
export async function hasActiveJob(documentId: string): Promise<boolean> {
  const jobs = await zdocsDb
    .select({ id: aiProcessingQueueTbl.id })
    .from(aiProcessingQueueTbl)
    .where(
      and(
        eq(aiProcessingQueueTbl.documentId, documentId),
        or(
          eq(aiProcessingQueueTbl.status, "PENDING"),
          eq(aiProcessingQueueTbl.status, "INSUFFICIENT_CREDITS"),
          eq(aiProcessingQueueTbl.status, "IN_PROGRESS")
        )
      )
    )
    .limit(1);

  return jobs.length > 0;
}

/**
 * Get a job by ID
 */
export async function getJobById(jobId: string): Promise<QueueJob | null> {
  const jobs = await zdocsDb
    .select()
    .from(aiProcessingQueueTbl)
    .where(eq(aiProcessingQueueTbl.id, jobId))
    .limit(1);

  return jobs[0] || null;
}

/**
 * Get the latest job for a document by action (org-scoped)
 */
export async function getLatestJobForDocumentForOrg(
  orgId: string,
  documentId: string,
  action: QueueJobAction
): Promise<QueueJob | null> {
  const jobs = await zdocsDb
    .select()
    .from(aiProcessingQueueTbl)
    .where(
      and(
        eq(aiProcessingQueueTbl.orgId, orgId),
        eq(aiProcessingQueueTbl.documentId, documentId),
        eq(aiProcessingQueueTbl.action, action)
      )
    )
    .orderBy(desc(aiProcessingQueueTbl.createdAt))
    .limit(1);
  return jobs[0] || null;
}

/**
 * Claim pending jobs for processing.
 * Returns jobs and marks them as IN_PROGRESS atomically.
 * Also claims KEY_ERROR and INSUFFICIENT_CREDITS jobs for retry.
 * Excludes jobs for deleted organizations.
 */
export async function claimPendingJobs(limit: number = 5): Promise<QueueJob[]> {
  // Get pending-like jobs that are ready to process
  const results = await zdocsDb
    .select({
      job: aiProcessingQueueTbl,
    })
    .from(aiProcessingQueueTbl)
    .innerJoin(
      organizationsTbl,
      eq(organizationsTbl.id, aiProcessingQueueTbl.orgId)
    )
    .where(
      and(
        or(
          eq(aiProcessingQueueTbl.status, "PENDING"),
          eq(aiProcessingQueueTbl.status, "INSUFFICIENT_CREDITS"),
          eq(aiProcessingQueueTbl.status, "KEY_ERROR")
        ),
        or(
          isNull(aiProcessingQueueTbl.retryAfter),
          lte(aiProcessingQueueTbl.retryAfter, new Date())
        ),
        isNull(organizationsTbl.deletedAt)
      )
    )
    .orderBy(
      desc(aiProcessingQueueTbl.priority),
      asc(aiProcessingQueueTbl.createdAt)
    )
    .limit(limit);

  const pendingJobs = results.map((r) => r.job);

  if (pendingJobs.length === 0) {
    return [];
  }

  // Mark claimed jobs as IN_PROGRESS
  const jobIds = pendingJobs.map((job) => job.id);
  const now = new Date();

  for (const jobId of jobIds) {
    await zdocsDb
      .update(aiProcessingQueueTbl)
      .set({
        status: "IN_PROGRESS",
        startedAt: now,
      })
      .where(
        and(
          eq(aiProcessingQueueTbl.id, jobId),
          or(
            eq(aiProcessingQueueTbl.status, "PENDING"), // Only claim if still pending
            eq(aiProcessingQueueTbl.status, "INSUFFICIENT_CREDITS"), // Or waiting for credits
            eq(aiProcessingQueueTbl.status, "KEY_ERROR") // Or if KEY_ERROR (for retry)
          )
        )
      );
  }

  // Return the claimed jobs
  return pendingJobs;
}

/**
 * Mark a job as completed successfully
 */
export async function completeJob(jobId: string): Promise<void> {
  await zdocsDb
    .update(aiProcessingQueueTbl)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
    })
    .where(eq(aiProcessingQueueTbl.id, jobId));
  console.log(`[Queue] Job ${jobId} completed`);
}

/**
 * Update the job action (for moving to next stage).
 * Used when classification completes and we need to move to extraction.
 *
 * @param jobId - The job ID
 * @param action - The new action (CLASSIFY or EXTRACT)
 */
export async function updateJobAction(
  jobId: string,
  action: QueueJobAction
): Promise<void> {
  await zdocsDb
    .update(aiProcessingQueueTbl)
    .set({
      action,
    })
    .where(eq(aiProcessingQueueTbl.id, jobId));
  console.log(`[Queue] Job ${jobId} action updated to ${action}`);
}

/**
 * Cancel a job permanently (no retry).
 * Use this when the underlying resource (document) no longer exists.
 *
 * @param jobId - The job ID
 * @param reason - Reason for cancellation
 */
export async function cancelJob(jobId: string, reason: string): Promise<void> {
  await zdocsDb
    .update(aiProcessingQueueTbl)
    .set({
      status: "CANCELLED",
      lastError: reason,
      completedAt: new Date(),
    })
    .where(eq(aiProcessingQueueTbl.id, jobId));
  console.log(`[Queue] Job ${jobId} cancelled: ${reason}`);
}

/**
 * Mark a job as failed, with optional retry scheduling
 *
 * @param jobId - The job ID
 * @param error - Error message from the failed attempt
 * @param isRateLimited - Whether this was a rate limit error (uses longer backoff)
 * @returns Whether the job was marked for retry (true) or failed permanently (false)
 */
export async function failJob(
  jobId: string,
  error: string,
  isRateLimited: boolean = false
): Promise<boolean> {
  const job = await getJobById(jobId);
  if (!job) {
    console.error(`Job ${jobId} not found for failure update`);
    return false;
  }

  const newAttempts = job.attempts + 1;
  const shouldRetry = newAttempts < job.maxAttempts;

  if (shouldRetry) {
    // Calculate exponential backoff
    const baseBackoff = isRateLimited ? DEFAULT_RATE_LIMIT_BACKOFF_SECONDS : 10;
    const backoffSeconds = baseBackoff * Math.pow(2, newAttempts - 1);

    // Parse retry delay from error if available (e.g., "retry in 18.5s")
    const retryMatch = error.match(/retry in (\d+\.?\d*)s/i);
    const parsedDelay = retryMatch
      ? Math.ceil(parseFloat(retryMatch[1]))
      : null;

    const actualBackoff = parsedDelay || backoffSeconds;
    const retryAfter = new Date(Date.now() + actualBackoff * 1000);

    console.log(
      `Job ${jobId} failed (attempt ${newAttempts}/${job.maxAttempts}), retrying after ${actualBackoff}s`
    );

    await zdocsDb
      .update(aiProcessingQueueTbl)
      .set({
        status: "PENDING", // Back to pending for retry
        attempts: newAttempts,
        lastError: error,
        retryAfter,
        startedAt: null, // Clear startedAt for fresh timing
      })
      .where(eq(aiProcessingQueueTbl.id, jobId));

    return true; // Will retry
  } else {
    // Max retries exceeded - mark as failed permanently
    console.log(
      `Job ${jobId} failed permanently after ${newAttempts} attempts`
    );

    await zdocsDb
      .update(aiProcessingQueueTbl)
      .set({
        status: "FAILED",
        attempts: newAttempts,
        lastError: error,
        completedAt: new Date(),
      })
      .where(eq(aiProcessingQueueTbl.id, jobId));

    await setDocumentExtractionFailed(
      job.orgId,
      job.documentId,
      `${error} (failed after ${newAttempts} attempts)`,
      actionToStage(job.action)
    );

    return false; // No more retries
  }
}

/**
 * Maximum number of KEY_ERROR retries before marking as FAILED.
 * This prevents overwhelming the system with repeated failed key attempts.
 */
const MAX_KEY_ERROR_RETRIES = 3;

/**
 * Mark a job as KEY_ERROR (API key issue - will retry automatically).
 * This is used when an AiKeyError occurs - the job will be retried
 * on the next cron run once the API key is fixed.
 *
 * After MAX_KEY_ERROR_RETRIES attempts, the job is marked as FAILED.
 *
 * @param jobId - The job ID
 * @param error - Error message from the failed attempt
 * @returns true if marked as KEY_ERROR (will retry), false if marked as FAILED (max retries)
 */
export async function setJobKeyError(
  jobId: string,
  error: string
): Promise<boolean> {
  // Fetch current attempts from the job
  const [job] = await zdocsDb
    .select({ attempts: aiProcessingQueueTbl.attempts })
    .from(aiProcessingQueueTbl)
    .where(eq(aiProcessingQueueTbl.id, jobId))
    .limit(1);

  const currentAttempts = job?.attempts ?? 0;
  const newAttempts = currentAttempts + 1;

  if (newAttempts >= MAX_KEY_ERROR_RETRIES) {
    // Max retries exceeded - mark as FAILED
    const errorMsg = `${error} (max KEY_ERROR retries exceeded after ${newAttempts} attempts)`;
    await zdocsDb
      .update(aiProcessingQueueTbl)
      .set({
        status: "FAILED",
        lastError: errorMsg,
        attempts: newAttempts,
        completedAt: new Date(),
      })
      .where(eq(aiProcessingQueueTbl.id, jobId));
    console.log(`[Queue] Job ${jobId} marked as FAILED - max KEY_ERROR retries (${MAX_KEY_ERROR_RETRIES}) exceeded`);

    const fullJob = await getJobById(jobId);
    if (fullJob) {
      await setDocumentExtractionFailed(
        fullJob.orgId,
        fullJob.documentId,
        errorMsg,
        actionToStage(fullJob.action)
      );
    }

    return false;
  }

  // Mark as KEY_ERROR for retry
  await zdocsDb
    .update(aiProcessingQueueTbl)
    .set({
      status: "KEY_ERROR",
      lastError: error,
      startedAt: null, // Clear startedAt so it can be retried
      attempts: newAttempts,
    })
    .where(eq(aiProcessingQueueTbl.id, jobId));
  console.log(`[Queue] Job ${jobId} marked as KEY_ERROR (attempt ${newAttempts}/${MAX_KEY_ERROR_RETRIES}) - will retry on next cron run`);
  return true;
}

/**
 * Mark a job as waiting for credits.
 * This behaves like PENDING on the next cron run, but does not increment attempts.
 */
export async function setJobInsufficientCredits(
  jobId: string,
  error: string
): Promise<void> {
  await zdocsDb
    .update(aiProcessingQueueTbl)
    .set({
      status: "INSUFFICIENT_CREDITS",
      lastError: error,
      retryAfter: null,
      startedAt: null,
    })
    .where(eq(aiProcessingQueueTbl.id, jobId));

  console.log(
    `[Queue] Job ${jobId} marked as INSUFFICIENT_CREDITS - will retry once credits are available`
  );
}

/**
 * Clean up stuck jobs that have been IN_PROGRESS for too long.
 * These are likely orphaned due to worker crashes or serverless timeouts.
 *
 * @param timeoutMinutes - How long a job can be IN_PROGRESS before considered stuck
 * @returns Number of jobs marked as TIMEOUT
 */
export async function cleanupStuckJobs(
  timeoutMinutes: number = DEFAULT_TIMEOUT_MINUTES
): Promise<number> {
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  const result = await zdocsDb
    .update(aiProcessingQueueTbl)
    .set({
      status: "PENDING", // Allow retry
      lastError: `Worker timeout after ${timeoutMinutes} minutes`,
      startedAt: null,
    })
    .where(
      and(
        eq(aiProcessingQueueTbl.status, "IN_PROGRESS"),
        lt(aiProcessingQueueTbl.startedAt, cutoffTime)
      )
    )
    .returning({ id: aiProcessingQueueTbl.id });

  if (result.length > 0) {
    console.log(`Cleaned up ${result.length} stuck jobs`);
  }

  return result.length;
}

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStats(orgId?: string): Promise<{
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}> {
  const baseCondition = orgId
    ? eq(aiProcessingQueueTbl.orgId, orgId)
    : undefined;

  const [pending, inProgress, completed, failed] = await Promise.all([
    zdocsDb
      .select()
      .from(aiProcessingQueueTbl)
      .where(
        baseCondition
          ? and(
            baseCondition,
            or(
              eq(aiProcessingQueueTbl.status, "PENDING"),
              eq(aiProcessingQueueTbl.status, "INSUFFICIENT_CREDITS")
            )
          )
          : or(
            eq(aiProcessingQueueTbl.status, "PENDING"),
            eq(aiProcessingQueueTbl.status, "INSUFFICIENT_CREDITS")
          )
      ),
    zdocsDb
      .select()
      .from(aiProcessingQueueTbl)
      .where(
        baseCondition
          ? and(baseCondition, eq(aiProcessingQueueTbl.status, "IN_PROGRESS"))
          : eq(aiProcessingQueueTbl.status, "IN_PROGRESS")
      ),
    zdocsDb
      .select()
      .from(aiProcessingQueueTbl)
      .where(
        baseCondition
          ? and(baseCondition, eq(aiProcessingQueueTbl.status, "COMPLETED"))
          : eq(aiProcessingQueueTbl.status, "COMPLETED")
      ),
    zdocsDb
      .select()
      .from(aiProcessingQueueTbl)
      .where(
        baseCondition
          ? and(baseCondition, eq(aiProcessingQueueTbl.status, "FAILED"))
          : eq(aiProcessingQueueTbl.status, "FAILED")
      ),
  ]);

  return {
    pending: pending.length,
    inProgress: inProgress.length,
    completed: completed.length,
    failed: failed.length,
  };
}
