import { generateObject } from "ai";
import type {
  DocumentTypeRecord,
  Document,
} from "@zdocs/types";
import { getAiExtractableFields } from "@zdocs/types";
import {
  getJsonFromCache,
  saveJsonToCache,
} from "./s3-cache";
import { logAiUsage } from "../ai/ai-usage-service";
import { ModelProviderResult } from "../ai/ai-key-provider";
import {
  extractPageLineItems,
  type ExtractPageLineItemsResult,
} from "./extract-page-line-items";
import type { ExtractedDocumentData } from "./types";
import { cleanNullStrings, cleanLineItemsNullStrings } from "./data-cleaning";
import { buildZodSchema } from "./zod-schema-builder";
import { buildFolderContext } from "./folder-context";
import {
  buildHeaderResponseSchema,
  buildLineItemsResponseSchema,
} from "./response-schema-builders";
import {
  buildExtractionPromptHeaders,
  buildExtractionPromptLineItems,
} from "./prompt-builders";
import { AdditionalCategoryPrompt } from "./category-mapping-service";
import { addCategoriesToExtractionPrompt } from "./helpers/add-categories-to-extraction-prompt";
import { serializeLineItem } from "./helpers/serialize-line-item";

type HeaderResult = {
  header: Record<string, unknown>;
  selectedFolder?: string | null;
};

/**
 * Multi-page extraction orchestrator
 * Extracts header and line items in parallel from the full document
 */
export async function extractMultiPageDocumentData(params: {
  document: Document;
  documentType: DocumentTypeRecord;
  imageBuffer: Buffer;
  modelResult: ModelProviderResult;
  orgId: string;
  cachePrefix: string;
  pageCount: number;
  additionalCategoryPrompt: AdditionalCategoryPrompt

}): Promise<ExtractedDocumentData> {
  const { document, documentType, imageBuffer, modelResult, orgId, cachePrefix, pageCount, additionalCategoryPrompt } = params;
  const { id: documentId } = document;
  const startTime = Date.now();
  console.log(
    `[Multi-page extraction] Starting for document ${documentId}, docType=${documentType.name}, model=${modelResult.modelSlug}`
  );

  // Convert full document to data URL once (shared by header and per-page extractions)
  const contentType = document.contentType || "application/pdf";
  const base64 = imageBuffer.toString("base64");
  const fullDocDataUrl = `data:${contentType};base64,${base64}`;

  // Build folder context (needed for header extraction)
  const { folderNamesMap, folderEnum, hasFolderMappings } =
    await buildFolderContext(documentType, orgId);

  // Run header and line items extraction in parallel (they are independent)
  console.log(`[Multi-page extraction] Running header and line items extraction in parallel`);

  const headerPromise = extractHeader({
    documentType, fullDocDataUrl, hasFolderMappings, folderEnum,
    folderNamesMap, modelResult, documentId, orgId, cachePrefix,
  });

  const lineItemsPromise = extractAllPageLineItems({
    documentType, fullDocDataUrl, pageCount, modelResult,
    documentId, orgId, cachePrefix,
    additionalCategoryPrompt
  });

  const [headerResult, allPageLineItems] = await Promise.all([
    headerPromise,
    lineItemsPromise,
  ]);

  // Step C: Aggregate results
  console.log(`[Multi-page extraction] Step C: Aggregating results (removing duplicates across pages)`);
  const mergedLineItems: Record<string, Record<string, unknown>[]> = {};
  // Track items seen in previous page extractions to deduplicate cross-page duplicates.
  // Within-page duplicates are intentionally preserved (same extraction = legitimate).
  const seenAcrossPages: Record<string, Set<string>> = {};

  for (const pageLineItems of allPageLineItems) {
    for (const [collectionKey, items] of Object.entries(pageLineItems)) {
      if (!mergedLineItems[collectionKey]) {
        mergedLineItems[collectionKey] = [];
        seenAcrossPages[collectionKey] = new Set();
      }

      if (items && items.length > 0) {
        const seenSet = seenAcrossPages[collectionKey];

        // Only include items not already seen in a previous page extraction
        const newItems = items.filter((item) => !seenSet.has(serializeLineItem(item)));
        const skippedCount = items.length - newItems.length;

        if (skippedCount > 0) {
          console.log(
            `[Multi-page extraction] Skipped ${skippedCount} duplicate item(s) in collection "${collectionKey}" (cross-page dedup)`
          );
        }

        mergedLineItems[collectionKey].push(...newItems);

        // Register all current-page items so future pages can deduplicate against them
        for (const item of items) {
          seenSet.add(serializeLineItem(item));
        }
      }
    }
  }

  const finalItemCounts = Object.fromEntries(
    Object.entries(mergedLineItems).map(([key, items]) => [key, items.length])
  );

  const extractedData: ExtractedDocumentData = {
    headerData: cleanNullStrings(headerResult.header as Record<string, unknown>),
    lineItems:
      Object.keys(mergedLineItems).length > 0
        ? cleanLineItemsNullStrings(mergedLineItems)
        : null,
    // selectedFolder comes from header extraction ONLY (Step 1)
    selectedFolder: headerResult.selectedFolder as string | undefined,
  };

  console.log(
    `[Multi-page extraction] Completed for document ${documentId}: headerFields=${Object.keys(extractedData.headerData).length}, lineItemCollections=${Object.keys(finalItemCounts).length}, totalItems=${Object.values(finalItemCounts).reduce((sum, count) => sum + count, 0)}, selectedFolder=${extractedData.selectedFolder ?? "null"}`
  );

  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(
    `[Multi-page extraction] Page extraction completed: ${duration}ms`
  );

  return extractedData;
}

/**
 * Extracts header from the full document
 */

async function extractHeader(params: {
  documentType: DocumentTypeRecord;
  fullDocDataUrl: string;
  hasFolderMappings: boolean;
  folderEnum: [string, ...string[]];
  folderNamesMap: Record<string, string>;
  modelResult: ModelProviderResult;
  documentId: string;
  orgId: string;
  cachePrefix: string;
}): Promise<HeaderResult> {
  const {
    documentType, fullDocDataUrl, hasFolderMappings, folderEnum,
    folderNamesMap, modelResult, documentId, orgId, cachePrefix,
  } = params;

  console.log(`[Multi-page extraction] Step A: Extracting header from full document`);

  const headerCacheKey = `${cachePrefix}/header.json`;

  const cachedHeader = await getJsonFromCache<HeaderResult>(headerCacheKey);

  if (cachedHeader) {
    console.log(`[Multi-page extraction] Header cache **HIT** for document ${documentId}`);
    return cachedHeader;
  }

  console.log(`[Multi-page extraction] Header cache **MISS** for document ${documentId}`);
  const aiHeaderFields = getAiExtractableFields(documentType.headerSchema);
  const headerZodSchema = buildZodSchema(aiHeaderFields);
  const headerResponseSchema = buildHeaderResponseSchema(
    headerZodSchema,
    hasFolderMappings,
    folderEnum
  );

  const headerPrompt = buildExtractionPromptHeaders(
    documentType.name,
    documentType.headerSchema,
    documentType.folderMapping,
    folderNamesMap
  );

  const { object, usage: headerUsage, response } = await generateObject({
    model: modelResult.modelObj,
    providerOptions: modelResult.providerOptions,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: fullDocDataUrl },
          { type: "text", text: headerPrompt },
        ],
      },
    ],
    schema: headerResponseSchema,
    schemaName: "DocumentExtractionHeader",
    schemaDescription: `Extracted header data from a ${documentType.displayName} document`,
  });

  const headerResult = object;

  console.log(
    `[Multi-page extraction] Header extraction completed: tokens=${headerUsage.totalTokens}, selectedFolder=${headerResult.selectedFolder ?? "null"}`
  );

  console.log(`[Multi-page extraction] Header data:`, JSON.stringify(headerResult.header, null, 2));

  if (!headerResult.header) {
    console.error(`[Multi-page extraction] Header extraction failed for document ${documentId}`);
    throw new Error(`Header extraction failed for document ${documentId}`);
  }

  await saveJsonToCache(headerCacheKey, headerResult);

  try {
    await logAiUsage({
      orgId,
      modelResult,
      usage: headerUsage,
      responseObj: response,
      entityId: documentId,
      entityType: "DOCUMENT",
      pageCount: 1,
      metadata: {
        documentId,
        step: "multi-page-header",
        pageCount: 1,
        usage: headerUsage,
      },
    });
  } catch (usageError) {
    console.error(
      `Failed to log AI usage for header extraction (document ${documentId}), continuing with extraction`,
      usageError
    );
  }

  return headerResult;
}

/**
 * Extracts line items from all pages of the document
 */
async function extractAllPageLineItems(params: {
  documentType: DocumentTypeRecord;
  fullDocDataUrl: string;
  pageCount: number;
  modelResult: ModelProviderResult;
  documentId: string;
  orgId: string;
  cachePrefix: string;
  additionalCategoryPrompt: AdditionalCategoryPrompt;
}): Promise<Record<string, Record<string, unknown>[]>[]> {
  const {
    documentType, fullDocDataUrl, pageCount, modelResult,
    documentId, orgId, cachePrefix,
    additionalCategoryPrompt
  } = params;

  console.log(`[Multi-page extraction] Step B: Extracting line items per page (${pageCount} pages)`);

  const lineItemsResponseSchema = buildLineItemsResponseSchema(
    documentType.lineItemSchemas!,
    additionalCategoryPrompt
  );

  const parallelExtraction = process.env.MULTIPAGE_EXTRACTION_PARALLEL_ENABLED === "true";

  const pageExtractionTasks = Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageNum = pageIndex + 1;
    const pageCacheKey = `${cachePrefix}/page-${pageNum}.json`;

    let lineItemsPrompt = buildExtractionPromptLineItems(
      documentType.name,
      documentType.lineItemSchemas!,
      pageNum,
      pageCount
    );
    if (additionalCategoryPrompt.enumCategoryValues.length > 0) {
      lineItemsPrompt = addCategoriesToExtractionPrompt(lineItemsPrompt, additionalCategoryPrompt);
    }

    return {
      pageNum,
      run: () => extractPageLineItems({
        documentDataUrl: fullDocDataUrl,
        pageNum,
        pageCacheKey,
        lineItemsPrompt,
        lineItemsResponseSchema,
        modelResult,
        documentId,
        orgId,
        documentType,
      }),
    };
  });

  let settledResults: PromiseSettledResult<ExtractPageLineItemsResult>[];

  if (parallelExtraction) {
    console.log(
      `[Multi-page extraction] Running ${pageExtractionTasks.length} pages in parallel`
    );
    settledResults = await Promise.allSettled(
      pageExtractionTasks.map((t) => t.run())
    );
  } else {
    console.log(
      `[Multi-page extraction] Running ${pageExtractionTasks.length} pages sequentially`
    );
    settledResults = [];
    for (const task of pageExtractionTasks) {
      settledResults.push(
        await task.run().then(
          (v) => ({ status: "fulfilled" as const, value: v }),
          (e) => ({ status: "rejected" as const, reason: e })
        )
      );
    }
  }

  const allPageLineItems: Record<string, Record<string, unknown>[]>[] = [];
  let failedPageCount = 0;
  let firstPageError: unknown = null;

  for (let i = 0; i < settledResults.length; i++) {
    const settled = settledResults[i];
    const pageNum = pageExtractionTasks[i].pageNum;

    if (settled.status === "rejected") {
      failedPageCount++;
      if (!firstPageError) firstPageError = settled.reason;
      console.warn(
        `[Multi-page extraction] Page ${pageNum} failed, skipping`,
        settled.reason
      );
      continue;
    }

    const { pageResult, fromCache } = settled.value;
    const sourceInfo = fromCache ? "cached" : "extracted";

    if (pageResult.lineItems) {
      const hasItems = Object.values(pageResult.lineItems).some(
        (items) => Array.isArray(items) && items.length > 0
      );
      if (hasItems) {
        const itemCounts = Object.fromEntries(
          Object.entries(pageResult.lineItems).map(([key, items]) => [
            key,
            Array.isArray(items) ? items.length : 0,
          ])
        );
        console.log(
          `[Multi-page extraction] Page ${pageNum} completed (${sourceInfo}): items=${JSON.stringify(itemCounts)}`
        );
        allPageLineItems.push(
          pageResult.lineItems as Record<string, Record<string, unknown>[]>
        );
      } else {
        console.log(
          `[Multi-page extraction] Page ${pageNum} completed (${sourceInfo}): no items found (skipped)`
        );
      }
    } else {
      console.log(
        `[Multi-page extraction] Page ${pageNum} completed (${sourceInfo}): lineItems=null (skipped)`
      );
    }
  }

  console.log(
    `[Multi-page extraction] Page extraction completed: ${allPageLineItems.length} pages with items out of ${pageCount} total pages (${failedPageCount} failed)`
  );

  if (failedPageCount > 0) {
    console.error(
      `[Multi-page extraction] ${failedPageCount}/${pageCount} pages failed for document ${documentId}, throwing to trigger retry (successful pages are cached)`
    );
    throw firstPageError ?? new Error(`${failedPageCount}/${pageCount} page extractions failed`);
  }

  return allPageLineItems;
}
