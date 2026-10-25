import { generateObject } from "ai";
import { getAiExtractableFields } from "@zdocs/types";
import {
  getDocumentTypeByNameForOrg,
  updateDocumentForOrg,
} from "@zdocs/db-schema";
import { logAiUsage } from "../ai/ai-usage-service";
import {
  type ModelProviderResult,
} from "../ai/ai-key-provider";
import type { ExtractedDocumentData, ExtractDocumentDataParams } from "./types";
import { cleanNullStrings, cleanLineItemsNullStrings } from "./data-cleaning";
import { buildZodSchema } from "./zod-schema-builder";
import { buildFolderContext } from "./folder-context";
import { buildFullResponseSchema } from "./response-schema-builders";
import { buildExtractionPrompt } from "./prompt-builders";
import { extractMultiPageDocumentData } from "./extract-multi-page-document-data";
import type { AdditionalCategoryPrompt } from "./category-mapping-service";
import { getPdfPageCount } from "./pdf-page-split";
import { saveJsonToCache } from "./s3-cache";
import { addCategoriesToExtractionPrompt } from "./helpers/add-categories-to-extraction-prompt";

type ExtractDocumentType = NonNullable<
  Awaited<ReturnType<typeof getDocumentTypeByNameForOrg>>
>;

export async function extractVisualDocumentData(params: {
  document: ExtractDocumentDataParams["document"];
  documentType: ExtractDocumentType;
  imageBuffer: Buffer;
  modelResult: ModelProviderResult;
  orgId: string;
  documentId: string;
  contentType: string;
  cachePrefix: string;
  cacheKey: string;
  additionalCategoryPrompt: AdditionalCategoryPrompt;
}): Promise<ExtractedDocumentData> {
  const {
    document,
    documentType,
    imageBuffer,
    orgId,
    documentId,
    contentType,
    cachePrefix,
    cacheKey,
    additionalCategoryPrompt,
    modelResult
  } = params;

  // Resolve page count: use DB value if available, otherwise count from PDF and persist
  let pageCount = document.pageCount;
  if (pageCount === null && contentType === "application/pdf") {
    try {
      pageCount = await getPdfPageCount(imageBuffer);
      console.log(
        `[Extraction] Counted ${pageCount} pages for PDF document ${documentId}, persisting to DB`
      );
      await updateDocumentForOrg(orgId, documentId, { pageCount });
    } catch (err) {
      console.warn(
        `[Extraction] Failed to count PDF pages for document ${documentId}, continuing without page count`,
        err
      );
    }
  }

  const multiPageExtractionSplitEnabled = process.env.MULTIPAGE_EXTRACTION_SPLIT_ENABLED === "true";

  console.log(
    `[Multi-page extraction] multiPageExtractionSplitEnabled=${multiPageExtractionSplitEnabled}`
  );

  const TRIGGER_MULTIPAGE_EXTRACTION_PAGE_COUNT = parseInt(process.env.TRIGGER_MULTIPAGE_EXTRACTION_PAGE_COUNT || "2");
  // Check if we should use multi-page extraction path
  const shouldUseMultiPage =
    multiPageExtractionSplitEnabled &&
    contentType === "application/pdf" &&
    (pageCount ?? 0) >= TRIGGER_MULTIPAGE_EXTRACTION_PAGE_COUNT &&
    documentType.lineItemSchemas &&
    Object.keys(documentType.lineItemSchemas).length > 0;

  //!!! START LOG ONLY
  if (!shouldUseMultiPage) {
    const reasons: string[] = [];
    if (contentType !== "application/pdf") reasons.push(`contentType=${contentType} (not PDF)`);
    if ((pageCount ?? 0) < 3) reasons.push(`pageCount=${pageCount} (< 3)`);
    if (!documentType.lineItemSchemas || Object.keys(documentType.lineItemSchemas).length === 0) {
      reasons.push(`no lineItemSchemas`);
    }
    console.log(
      `[Multi-page extraction] Not triggered for document ${documentId}: ${reasons.join(", ")}`
    );
  }
  //!!! END LOG ONLY


  if (shouldUseMultiPage) {
    console.log(
      `[Multi-page extraction] Triggered for document ${documentId}: contentType=${contentType}, pageCount=${pageCount}, hasLineItemSchemas=true, collectionKeys=${Object.keys(documentType.lineItemSchemas!).join(",")}`
    );
    try {
      const extractedData = await extractMultiPageDocumentData({
        document,
        documentType,
        imageBuffer,
        modelResult,
        orgId,
        cachePrefix,
        pageCount: pageCount!,
        additionalCategoryPrompt,
      });
      console.log(
        `[Multi-page extraction] Caching result for document ${documentId}`
      );
      await saveJsonToCache(cacheKey, extractedData);
      return extractedData;
    } catch (error) {
      // Re-throw so the pipeline retry logic in extractDocument handles it.
      // Successful pages are already cached in S3; on retry only failed pages
      // will be re-extracted.
      throw error;
    }
  }

  // Single-pass extraction path (existing behavior)
  console.log(
    `[Single-pass extraction] Using standard extraction path for document ${documentId}`
  );
  // Build Zod schema for structured output (only AI-extractable fields)
  const aiHeaderFields = getAiExtractableFields(documentType.headerSchema);
  const headerZodSchema = buildZodSchema(aiHeaderFields);

  // Build folder context
  const { folderNamesMap, folderEnum, hasFolderMappings } =
    await buildFolderContext(documentType, orgId);

  // Build response schema
  const responseSchema = buildFullResponseSchema(
    headerZodSchema,
    documentType.lineItemSchemas,
    hasFolderMappings,
    folderEnum,
    additionalCategoryPrompt
  );

  // Build prompt
  let prompt = buildExtractionPrompt(
    documentType.name,
    documentType.headerSchema,
    documentType.lineItemSchemas,
    documentType.folderMapping,
    folderNamesMap
  );

  if (additionalCategoryPrompt.categoryTextList.length > 0) {
    prompt = addCategoriesToExtractionPrompt(prompt, additionalCategoryPrompt);
  }

  // Convert buffer to base64 data URL for vision API
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;

  // Call AI Vision with structured output
  const startTime = Date.now();
  const { object, usage, response } = await generateObject({
    model: modelResult.modelObj,
    providerOptions: modelResult.providerOptions,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: dataUrl },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    schema: responseSchema,
    schemaName: "DocumentExtraction",
    schemaDescription: `Extracted data from a ${documentType.displayName} document`,
  });

  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(
    `[Single-pass extraction] Duration: ${duration}ms`
  );

  const extractedData: ExtractedDocumentData = {
    headerData: cleanNullStrings(object.header as Record<string, unknown>),
    lineItems: object.lineItems
      ? cleanLineItemsNullStrings(
        object.lineItems as Record<string, Record<string, unknown>[]>
      )
      : null,
    selectedFolder: object.selectedFolder as string | undefined,
  };

  // Log AI usage (logging failures should not fail extraction)
  try {
    await logAiUsage({
      orgId,
      modelResult,
      usage,
      responseObj: response,
      entityId: documentId,
      entityType: "DOCUMENT",
      pageCount: pageCount ?? 1,
      metadata: {
        documentId,
        pageCount: pageCount ?? 1,
        usage,
      },
    });
  } catch (usageError) {
    console.error(
      `Failed to log AI usage for single-pass extraction (document ${documentId}), continuing`,
      usageError
    );
  }

  // Save to cache
  await saveJsonToCache(cacheKey, extractedData);

  return extractedData;
}
