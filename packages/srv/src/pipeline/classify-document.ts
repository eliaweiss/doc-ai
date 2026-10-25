import {
  getDocumentForOrg,
  getDocumentTypesForOrg,
  getDocumentTypeByNameForOrg,
  upsertDocumentDataForOrg,
  updateDocumentClassification,
  updateJobAction,
  moveDocumentForOrg,
  getRootFolderForOrg,
  setDocumentExtractionFailed,
  setDocumentExtractionRetrying,
  updateDocumentForOrg,
  failJob,
  setJobKeyError,
} from "@zdocs/db-schema";
import { DOCUMENT_LIMITS } from "@zdocs/types";
import { fetchDocumentFromS3 } from "../extraction/s3-cache";
import { scheduleQueueRetry } from "../services/task-scheduler";
import { classifyDocumentWithTypes } from "../extraction/classification-service";
import { getPdfPageCount } from "../extraction/pdf-page-split";
import { AiKeyError } from "../ai/ai-key-provider";

export interface ClassifyDocumentParams {
  orgId: string;
  documentId: string;
  jobId?: string;
}

export interface ClassifyDocumentResult {
  success: boolean;
  classification?: {
    docType: string;
    title: string | null;
    totalAmount: number | null;
    date: string | null;
  };
  documentId: string;
  jobId?: string;
  error?: string;
}

/**
 * Classify a document - runs the SAME code in both Vercel and Lambda.
 * This function is environment-agnostic and handles its own lifecycle.
 *
 * Steps:
 * 1. Fetch document from DB
 * 2. Fetch document from S3
 * 3. Get available document types
 * 4. Classify using AI Vision
 * 5. Upsert document_data with partial data
 * 6. Update document with classification results
 * 7. Move to default folder if applicable
 * 8. Fire-and-forget to next step (/extract endpoint)
 *
 * On failure:
 * - Updates job status to FAILED (if jobId provided)
 * - Updates document extraction status to FAILED
 * - Returns { success: false, error: "..." }
 */
export async function classifyDocument(
  params: ClassifyDocumentParams
): Promise<ClassifyDocumentResult> {
  const { orgId, documentId, jobId } = params;

  try {
    // Update queue to track we're starting classification
    if (jobId) {
      await updateJobAction(jobId, "CLASSIFY");
    }

    // 1. Get the document (org-scoped)
    const document = await getDocumentForOrg(orgId, documentId);

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const docHash = document.contentHash || document.s3Key;

    // 2. Fetch document from S3
    console.log(`Processing document: ${documentId}`);
    const fileBuffer = await fetchDocumentFromS3(
      document.s3Bucket,
      document.s3Key,
      document.s3Region
    );

    // 2b. Count and persist page count for PDFs (needed for multi-page extraction trigger)
    let resolvedPageCount = document.pageCount;
    if (document.contentType === "application/pdf" && resolvedPageCount === null) {
      try {
        resolvedPageCount = await getPdfPageCount(fileBuffer);
        console.log(
          `[Classify] Counted ${resolvedPageCount} pages for PDF document ${documentId}, persisting to DB`
        );
        await updateDocumentForOrg(orgId, documentId, { pageCount: resolvedPageCount });
      } catch (err) {
        console.warn(
          `[Classify] Failed to count PDF pages for document ${documentId}, continuing`,
          err
        );
      }
    }

    // 2c. Trim text documents that exceed line limits
    const trimmedBuffer = trimToDocumentLimits(
      document.contentType,
      fileBuffer
    );

    // 3. Get available document types for this org (excluding datasets)
    const availableTypes = await getDocumentTypesForOrg(orgId, {
      includeDatasets: false,
    });

    if (availableTypes.length === 0) {
      throw new Error(
        "No document types available. System may not be initialized."
      );
    }

    // 4. Classify document using vision/image directly (with caching)
    console.log(`Classifying document: ${documentId}`);
    const classification = await classifyDocumentWithTypes({
      docHash,
      imageBuffer: trimmedBuffer,
      contentType: document.contentType,
      availableTypes,
      orgId,
      documentId,
    });

    console.log(
      `[Classify] Classification result for ${documentId}:`,
      JSON.stringify(classification)
    );

    // Validate classification result
    if (!classification.docType) {
      throw new Error(
        `Classification returned undefined docType. Full result: ${JSON.stringify(
          classification
        )}`
      );
    }

    // 5. Upsert document_data with partial data from classification
    await upsertDocumentDataForOrg(orgId, documentId, {
      headerData: { title: classification.title },
      totalAmount: classification.totalAmount || null,
      documentDate: classification.date ? classification.date : undefined,
    });

    // 6. Update document with classification results
    await updateDocumentClassification(orgId, documentId, {
      docType: classification.docType,
      description: classification.title,
      documentDate: classification.date ? classification.date : null,
    });

    // 7. Move document to default folder if:
    //    - Document type has a defaultFolderId configured
    //    - Document doesn't already have a folder assigned
    if (!document.folderId) {
      try {
        const documentType = await getDocumentTypeByNameForOrg(
          classification.docType,
          orgId
        );
        if (documentType?.defaultFolderId) {
          await moveDocumentForOrg(
            orgId,
            documentId,
            documentType.defaultFolderId
          );
          console.log(
            `Moved document ${documentId} to default folder ${documentType.defaultFolderId} for type ${classification.docType}`
          );
        } else {
          // Move to root folder if no default folder is configured
          const rootFolder = await getRootFolderForOrg(orgId);
          if (rootFolder) {
            await moveDocumentForOrg(orgId, documentId, rootFolder.id);
            console.log(
              `Moved document ${documentId} to root folder ${rootFolder.id}`
            );
          }
        }
      } catch (folderError) {
        // Log but don't fail - folder assignment is not critical
        console.error(
          "Failed to move document to default folder:",
          folderError
        );
      }
    }

    // Update queue to track we're moving to extraction
    if (jobId) {
      await updateJobAction(jobId, "EXTRACT");
    }

    console.log(`Document classified as: ${classification.docType}`);

    // 8. Dispatch to next step (extraction endpoint)
    // MUST await in Lambda - fire-and-forget would be killed when handler returns
    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (baseUrl) {
      const extractUrl = `${baseUrl}/api/org/${orgId}/documents/${documentId}/extract`;
      console.log(`Dispatching to next step: ${extractUrl}`);
      try {
        const response = await fetch(extractUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.CRON_SECRET
              ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
              : {}),
          },
          body: JSON.stringify({ jobId }),
        });
        console.log(`Extract dispatch response: ${response.status}`);
      } catch (error) {
        console.error("Failed to dispatch to next step:", error);
      }
    }

    return {
      success: true,
      classification: {
        docType: classification.docType,
        title: classification.title,
        totalAmount: classification.totalAmount,
        date: classification.date,
      },
      documentId,
      jobId,
    };
  } catch (error) {
    console.error("Error classifying document:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle AiKeyError specially - mark as KEY_ERROR for retry
    if (error instanceof AiKeyError) {
      try {
        // Update document status
        await updateDocumentForOrg(orgId, documentId, {
          extractionStatus: "KEY_ERROR",
          extractionErrors: {
            errorMessage: error.message,
            errorCode: error.code,
            stage: "classification",
          },
        });

        // Update job status to KEY_ERROR so it will be retried
        if (jobId) {
          await setJobKeyError(jobId, errorMessage);
        }
      } catch (updateError) {
        console.error("Failed to update document/job status to KEY_ERROR:", updateError);
      }

      return {
        success: false,
        documentId,
        jobId,
        error: errorMessage,
      };
    }

    // Check if this is a rate limit error
    const isRateLimited =
      errorMessage.includes("429") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("rate limit");

    // Update queue job to FAILED if jobId was provided
    let shouldRetry = false;
    if (jobId) {
      try {
        shouldRetry = await failJob(jobId, errorMessage, isRateLimited);
        if (shouldRetry) {
          scheduleQueueRetry(5).catch((err) => {
            console.error("[Pipeline] Failed to schedule queue retry:", err);
          });
        }
      } catch (failJobError) {
        console.error("Failed to update job status:", failJobError);
      }
    }

    // Update document status - RETRYING if will retry, FAILED if permanent failure
    try {
      if (shouldRetry) {
        await setDocumentExtractionRetrying(
          orgId,
          documentId,
          errorMessage,
          "classification"
        );
      } else {
        await setDocumentExtractionFailed(
          orgId,
          documentId,
          errorMessage,
          "classification"
        );
      }
    } catch (updateError) {
      console.error("Failed to update document status:", updateError);
    }

    return {
      success: false,
      documentId,
      jobId,
      error: errorMessage,
    };
  }
}

const TEXT_CONTENT_TYPES = new Set([
  "text/csv",
  "text/xml",
  "application/xml",
  "text/plain",
]);

function isTextContentType(contentType: string): boolean {
  return TEXT_CONTENT_TYPES.has(contentType);
}

function countLines(buffer: Buffer): number {
  let count = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0a) count++;
  }
  if (buffer.length > 0 && buffer[buffer.length - 1] !== 0x0a) count++;
  return count;
}

function trimToDocumentLimits(
  contentType: string,
  fileBuffer: Buffer
): Buffer {
  if (!isTextContentType(contentType)) {
    return fileBuffer;
  }

  const lineCount = countLines(fileBuffer);
  if (lineCount <= DOCUMENT_LIMITS.maxTextLines) {
    return fileBuffer;
  }

  console.log(
    `[Classify] Trimming text document from ${lineCount} to ${DOCUMENT_LIMITS.maxTextLines} lines for classification`
  );

  let newlineCount = 0;
  let cutoffIndex = fileBuffer.length;
  for (let i = 0; i < fileBuffer.length; i++) {
    if (fileBuffer[i] === 0x0a) {
      newlineCount++;
      if (newlineCount === DOCUMENT_LIMITS.maxTextLines) {
        cutoffIndex = i + 1;
        break;
      }
    }
  }

  return fileBuffer.subarray(0, cutoffIndex);
}
