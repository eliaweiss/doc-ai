/**
 * In-process queue worker (replaces zdocs' cron route + HTTP self-dispatch + Lambda).
 *
 * zdocs: cron claims jobs and POSTs to /classify, which POSTs to /extract.
 * doc-ai: one loop claims jobs and calls the same pipeline functions directly.
 * Job/document state transitions (failJob, retries, KEY_ERROR, ...) are
 * unchanged because they live inside the copied pipeline functions.
 */
import {
  claimPendingJobs,
  cleanupStuckJobs,
  cancelJob,
  getDocumentForOrg,
} from "@zdocs/db-schema";
import { classifyDocument, extractDocument, getConfig } from "@zdocs/srv";
import { syncDocumentFile } from "./folder-sync";
import type { QueueJob } from "@zdocs/types";

const POLL_INTERVAL_MS = 5_000;
const CONCURRENCY = Number(process.env.DOC_AI_WORKER_CONCURRENCY || 2);

async function runJob(job: QueueJob): Promise<void> {
  const { orgId, documentId, id: jobId } = job;

  const document = await getDocumentForOrg(orgId, documentId);
  if (!document) {
    await cancelJob(jobId, "Document no longer exists");
    return;
  }

  if (job.action === "CLASSIFY") {
    const classified = await classifyDocument({ orgId, documentId, jobId });
    if (!classified.success) return;
  }

  await extractDocument({ orgId, documentId, jobId });

  // Classification / folder rules may have moved the document: move its file too
  if (getConfig().watchDir) {
    await syncDocumentFile(documentId).catch((error) =>
      console.error(`[Worker] Failed to move file for ${documentId}:`, error)
    );
  }
}

export function startWorker() {
  let running = 0;
  let drained: (() => void) | null = null;
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const free = CONCURRENCY - running;
      if (free > 0) {
        const jobs = await claimPendingJobs(free);
        for (const job of jobs) {
          running++;
          console.log(`[Worker] ${job.action} document ${job.documentId} (job ${job.id})`);
          runJob(job)
            .catch((error) => console.error(`[Worker] Job ${job.id} failed:`, error))
            .finally(() => {
              running--;
              if (running === 0) drained?.();
              kick();
            });
        }
      }
    } catch (error) {
      console.error("[Worker] Tick failed:", error);
    }
    schedule(POLL_INTERVAL_MS);
  }

  function schedule(ms: number) {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }

  /** Run a tick soon (called when a job is enqueued or finishes) */
  function kick() {
    schedule(50);
  }

  // Single process: anything IN_PROGRESS is left over from a previous run
  cleanupStuckJobs(0)
    .catch((error) => console.error("[Worker] Failed to reset stuck jobs:", error))
    .finally(() => schedule(0));

  console.log(`[Worker] Started (concurrency ${CONCURRENCY})`);

  return {
    kick,
    /** Stop claiming jobs; resolves once the running ones have finished */
    stop(): Promise<void> {
      stopped = true;
      if (timer) clearTimeout(timer);
      return running === 0 ? Promise.resolve() : new Promise((resolve) => (drained = resolve));
    },
  };
}
