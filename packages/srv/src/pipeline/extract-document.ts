import {
  getDocumentForOrg,
  upsertDocumentDataForOrg,
  updateDocumentExtraction,
  indexDocument, completeJob,
  cancelJob,
  failJob,
  setJobKeyError,
  setDocumentExtractionFailed,
  setDocumentExtractionRetrying,
  setDocumentExtractionPartial,
  updateDocumentForOrg,
  loadDatasetsForFormulas,
  collectDatasetTypeNames,
  moveDocumentForOrg,
  getFoldersByOrgId,
  getRootFolderForOrg,
  getFolderForOrg,
  getJobById,
} from "@zdocs/db-schema";
import { extractDocumentData } from "../extraction/unified-extraction-service";
import { scheduleQueueRetry } from "../services/task-scheduler";
import { evaluateFormulas } from "../extraction/formula-service";
import { saveNotifications } from "../extraction/notification-service";
import { AiKeyError } from "../ai/ai-key-provider";
import { FileSizeLimitError } from "../storage/file-size-limits";
import {
  DenormalizedValues, getDenormalizedValues,
  TransactionType
} from "@zdocs/types";

export interface ExtractDocumentParams {
  orgId: string;
  documentId: string;
  jobId?: string;
  forceReExtract?: boolean;
}

export interface ExtractDocumentResult {
  success: boolean;
  documentId: string;
  docType?: string;
  headerData?: Record<string, unknown>;
  lineItems?: Record<string, Record<string, unknown>[]> | null;
  denormalized?: DenormalizedValues;
  jobId?: string;
  error?: string;
}

/**
 * Extract document data - runs the SAME code in both Vercel and Lambda.
 * This function is environment-agnostic and handles its own lifecycle.
 *
 * Prerequisites:
 * - Document must have a docType (set during classification)
 * - Document should have document_data row (created during classification)
 *
 * Steps:
 * 1. Fetch document from DB
 * 2. Extract data using AI Vision
 * 3. Get denormalized values
 * 4. Save extracted data to DB BEFORE formula evaluation
 * 5. Evaluate formulas (sum → code → ai)
 * 6. Save notifications
 * 7. Upsert document_data
 * 8. Update document status
 * 9. Trigger indexing
 * 10. Mark job complete
 * 11. Fire-and-forget completion callback (/complete endpoint)
 *
 * On failure:
 * - Updates job status to FAILED (if jobId provided)
 * - Updates document extraction status to FAILED
 * - Returns { success: false, error: "..." }
 */
export async function extractDocument(
  params: ExtractDocumentParams
): Promise<ExtractDocumentResult> {
  const { orgId, documentId, jobId, forceReExtract } = params;

  console.log(`[Extract] extractDocument called with params:`, params);

  try {
    // 1. Get the document (org-scoped)
    const document = await getDocumentForOrg(orgId, documentId);

    if (!document) {
      throw new Error("Document not found");
    }

    console.log(`[Extract] Document fetched - current extractionStatus: ${document.extractionStatus}`);

    await setDocumentExtractionPartial(orgId, documentId);
    console.log(`[Extract] Set extractionStatus to PARTIAL for ${documentId}`);

    // Check if document has a docType (should be set during classification)
    if (!document.docType) {
      throw new Error("Document has no type. Classification may have failed.");
    }

    // 2. Extract data using AI Vision
    // Only real failed attempts increment `attempts`; a retry reuses cached pages.
    // INSUFFICIENT_CREDITS behaves like PENDING and does not count as a retry.
    let isRetry = false;
    if (jobId) {
      const job = await getJobById(jobId);
      if (job && job.attempts > 0) {
        isRetry = true;
        console.log(`[Extract] Retry detected (attempt ${job.attempts + 1}/${job.maxAttempts}) - reusing cached pages`);
      }
    }

    const { documentType, extractedData } = await extractDocumentData({
      document,
      forceReExtract,
      isRetry,
    });

    // 2.1 Handle AI-driven folder mapping
    console.log("[Extract] orgId", orgId);
    const rootFolder = await getRootFolderForOrg(orgId);
    console.log("[Extract] rootFolder", rootFolder?.id);
    let folderId = document.folderId || rootFolder?.id;
    let transactionType: TransactionType | null = null;

    // console.log(
    //   `[Extract] Starting folder mapping check for document ${documentId}`
    // );
    // console.log(`[Extract] Current folderId: ${document.folderId || "null"}`);
    // console.log(
    //   `[Extract] AI selectedFolder: ${extractedData.selectedFolder || "null"}`
    // );
    // console.log(
    //   `[Extract] Document type has folderMapping: ${
    //     documentType.folderMapping
    //       ? `${documentType.folderMapping.length} mappings`
    //       : "none"
    //   }`
    // );

    if (
      extractedData.selectedFolder &&
      extractedData.selectedFolder !== "NONE" &&
      documentType.folderMapping &&
      documentType.folderMapping.length > 0
    ) {
      // console.log(
      //   `[Extract] Processing folder mapping - AI selected: "${extractedData.selectedFolder}"`
      // );
      // console.log(
      //   `[Extract] Folder mappings configured:`,
      //   JSON.stringify(
      //     documentType.folderMapping.map((m) => ({
      //       folderId: m.folderId,
      //       hint: m.extractionHint,
      //       transactionType: m.transactionType,
      //     }))
      //   )
      // );

      const folders = await getFoldersByOrgId(orgId);
      console.log(
        `[Extract] Fetched ${folders.length} folders for org ${orgId}`
      );

      const folderNameToId: Record<
        string,
        { id: string; transactionType?: TransactionType | null }
      > = {};

      for (const mapping of documentType.folderMapping) {
        const folder = folders.find((f) => f.id === mapping.folderId);
        if (folder) {
          folderNameToId[folder.name] = {
            id: folder.id,
            transactionType: mapping.transactionType,
          };
          // console.log(
          //   `[Extract] Mapped folder "${folder.name}" (${
          //     folder.id
          //   }) (transactionType: ${mapping.transactionType || "null"})`
          // );
        } else {
          console.warn(
            `[Extract] Folder mapping references non-existent folder: ${mapping.folderId}`
          );
        }
      }

      // console.log(
      //   `[Extract] Built folder name-to-id mapping:`,
      //   JSON.stringify(
      //     Object.keys(folderNameToId).map((name) => ({
      //       name,
      //       folderId: folderNameToId[name].id,
      //       transactionType: folderNameToId[name].transactionType,
      //     }))
      //   )
      // );

      const match = folderNameToId[extractedData.selectedFolder];
      if (match) {
        console.log(
          `[Extract] Found match for "${extractedData.selectedFolder
          }" -> folderId: ${match.id}, transactionType: ${match.transactionType || "null"
          }`
        );
        folderId = match.id;
        transactionType = match.transactionType || null;

        // Move document to selected folder (overrides existing)
        if (folderId !== document.folderId) {
          console.log(
            `[Extract] Moving document from folder ${document.folderId || "null"
            } to ${folderId}`
          );
          await moveDocumentForOrg(orgId, documentId, folderId);
          console.log(
            `[Extract] AI moved document ${documentId} to folder ${folderId} (${extractedData.selectedFolder})`
          );
        } else {
          console.log(
            `[Extract] Document already in folder ${folderId}, no move needed`
          );
        }
      } else {
        console.warn(
          `[Extract] No match found for AI selection "${extractedData.selectedFolder}" in slug mapping`
        );
        // console.warn(
        //   `[Extract] Available folder names: ${Object.keys(folderNameToId).join(
        //     ", "
        //   )}`
        // );
      }
    } else {
      if (
        !extractedData.selectedFolder ||
        extractedData.selectedFolder === "NONE"
      ) {
        console.log(
          `[Extract] AI selected "NONE" or no selection, skipping folder mapping`
        );
      } else if (
        !documentType.folderMapping ||
        documentType.folderMapping.length === 0
      ) {
        console.log(
          `[Extract] No folder mappings configured for document type ${documentType.name}`
        );
      }
    }

    // prefer document type default folder, then root folder
    folderId = folderId || rootFolder?.id;
    if (folderId == rootFolder?.id) {
      console.log(`[Extract] documentType.defaultFolderId ${documentType.defaultFolderId}`);
      folderId = documentType.defaultFolderId || rootFolder?.id;
    }

    // Verify folderId exists for this org, fallback to root if not
    if (folderId) {
      const folderExists = await getFolderForOrg(orgId, folderId);
      if (!folderExists) {
        console.error(
          `[Extract] Folder ${folderId} does not exist for org ${orgId}, falling back to root folder`
        );
        folderId = rootFolder?.id;
      }
    }

    console.log(
      `[Extract] Final folderId: ${folderId || "null"}, transactionType: ${transactionType || "null"
      }`
    );

    // Move document to final folder if needed
    if (folderId && folderId !== document.folderId) {
      console.log(
        `[Extract] Moving document from folder ${document.folderId || "null"
        } to default folder ${folderId}`
      );
      await moveDocumentForOrg(orgId, documentId, folderId);
      console.log(`[Extract] Moved document ${documentId} to folder ${folderId}`);
    }

    // 3. Get denormalized values
    // console.log(`[Extract] Header data after extraction:`, JSON.stringify(extractedData.headerData, null, 2));
    const denormalizedValues = getDenormalizedValues(
      extractedData.headerData,
      documentType.headerSchema
    );
    // console.log(`[Extract] Denormalized values:`, JSON.stringify(denormalizedValues, null, 2));



    // 4. Save extracted data to DB BEFORE formula evaluation
    // Formula code fields may call external webhooks 
    // that read document data from the DB. We must persist headerData/lineItems
    // first so they're available when webhooks query the DB.
    await upsertDocumentDataForOrg(orgId, documentId, {
      headerData: extractedData.headerData,
      lineItems: extractedData.lineItems,
      totalAmount: denormalizedValues.amount,
      transactionType,
      documentDate: denormalizedValues.date || undefined,
      dueDate: denormalizedValues.dueDate,
      schemaEntityVersion: documentType.entityVersion,
    });
    console.log(
      `[Extract] Saved extracted data to DB before formula evaluation for ${documentId}`
    );

    // 5. Evaluate formulas (sum fields, code fields, AI fields)
    // Execution order: sum → code → ai

    // Collect dataset type names from formulas and load them
    const datasetTypeNames = collectDatasetTypeNames(
      documentType.headerSchema,
      documentType.lineItemSchemas
    );
    const datasets =
      datasetTypeNames.length > 0
        ? await loadDatasetsForFormulas(orgId, datasetTypeNames)
        : {};

    // Build file metadata for formula context
    const fileMetadata = {
      id: document.id,
      fileName: document.fileName || "",
      uploadDate: document.createdAt.toISOString(),
      fileType: document.contentType,
      status: document.extractionStatus,
    };

    const formulaResult = await evaluateFormulas({
      documentType,
      extractedData: {
        headerData: extractedData.headerData,
        lineItems: extractedData.lineItems || {},
      },
      fileMetadata,
      datasets,
    });

    // Merge formula-computed values back into extracted data
    extractedData.headerData = formulaResult.headerData;
    extractedData.lineItems = formulaResult.lineItems;
    console.log(`[Extract] Header data after formulas:`, JSON.stringify(extractedData.headerData, null, 2));

    // 6. Save notifications (warning/error go to DB, info stays in document_data only)
    const documentNotifications = await saveNotifications(
      orgId,
      documentId,
      formulaResult.notifications
    );

    // Log notifications for debugging
    if (documentNotifications.length > 0) {
      console.log(
        `[Extract] Saved ${documentNotifications.length} notification(s) for ${documentId}:`,
        documentNotifications.map((n) => `[${n.level}] ${n.message}`)
      );
    }

    // 7. Recalculate denormalized values after formulas (sum fields may have denormalizedAs)
    const finalDenormalizedValues = getDenormalizedValues(
      extractedData.headerData,
      documentType.headerSchema
    );
    console.log(
      "[Extract] Upserting document_data with denormalizedValues",
      finalDenormalizedValues
    );

    await upsertDocumentDataForOrg(orgId, documentId, {
      headerData: extractedData.headerData,
      lineItems: extractedData.lineItems,
      totalAmount: finalDenormalizedValues.amount,
      transactionType,
      documentDate: finalDenormalizedValues.date || undefined,
      dueDate: finalDenormalizedValues.dueDate,
      notifications:
        documentNotifications.length > 0 ? documentNotifications : null,
      schemaEntityVersion: documentType.entityVersion,
      headerSchema: documentType.headerSchema,
    });

    // 8. Update document status
    await updateDocumentExtraction(orgId, documentId, {
      documentDate: finalDenormalizedValues.date,
      currency:
        (extractedData.headerData.currency as string) ||
        finalDenormalizedValues.currency ||
        document.currency,
    });

    // 9. Trigger indexing (awaited to ensure it completes before marking job done)
    try {
      await indexDocument(documentId, orgId);
    } catch (error) {
      console.error(`Failed to index document ${documentId}:`, error);
      // Don't fail the whole job if indexing fails - extraction succeeded
    }

    // 10. Mark queue job as completed if jobId provided
    if (jobId) {
      await completeJob(jobId);
      console.log(`[Extract] Job completed: ${jobId}`);
    } else {
      console.log(`[Extract] No jobId provided`);
    }

    // 11. Completion callback - MUST await in Lambda
    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (baseUrl) {
      const completeUrl = `${baseUrl}/api/org/${orgId}/documents/${documentId}/complete`;
      console.log(`Notifying completion: ${completeUrl}`);
      try {
        const response = await fetch(completeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.CRON_SECRET
              ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
              : {}),
          },
          body: JSON.stringify({
            status: "success",
            docType: documentType.name,
            jobId,
          }),
        });
        console.log(`Complete callback response: ${response.status}`);
      } catch (error) {
        console.error("Failed to notify completion:", error);
      }
    }

    return {
      success: true,
      documentId,
      docType: documentType.name,
      headerData: extractedData.headerData,
      lineItems: extractedData.lineItems,
      denormalized: denormalizedValues,
      jobId,
    };
  } catch (error) {
    console.error("Error extracting document data:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (error instanceof FileSizeLimitError) {
      try {
        await setDocumentExtractionFailed(
          orgId,
          documentId,
          errorMessage,
          "extraction"
        );
        if (jobId) {
          await cancelJob(jobId, errorMessage);
        }
      } catch (updateError) {
        console.error("Failed to update document/job status for file size limit:", updateError);
      }

      return {
        success: false,
        documentId,
        jobId,
        error: errorMessage,
      };
    }

    // Handle AiKeyError specially - mark as KEY_ERROR for retry
    if (error instanceof AiKeyError) {
      try {
        // Update document status
        await updateDocumentForOrg(orgId, documentId, {
          extractionStatus: "KEY_ERROR",
          extractionErrors: {
            errorMessage: error.message,
            errorCode: error.code,
            stage: "extraction",
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
          "extraction"
        );
      } else {
        await setDocumentExtractionFailed(
          orgId,
          documentId,
          errorMessage,
          "extraction"
        );
      }
    } catch (updateError) {
      console.error("Failed to update document status:", updateError);
    }

    // Completion callback for failure - MUST await in Lambda
    const baseUrl = process.env.NEXT_PUBLIC_URL;
    if (baseUrl) {
      const completeUrl = `${baseUrl}/api/org/${orgId}/documents/${documentId}/complete`;
      try {
        await fetch(completeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.CRON_SECRET
              ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
              : {}),
          },
          body: JSON.stringify({
            status: "failed",
            error: errorMessage,
            jobId,
          }),
        });
      } catch (err) {
        console.error("Failed to notify completion (failure):", err);
      }
    }

    return {
      success: false,
      documentId,
      jobId,
      error: errorMessage,
    };
  }
}
