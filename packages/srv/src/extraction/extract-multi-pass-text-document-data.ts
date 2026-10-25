import { generateObject } from "ai";
import { z } from "zod";
import type { DocumentTypeRecord, Document } from "@zdocs/types";
import { getAiExtractableFields } from "@zdocs/types";
import { getJsonFromCache, saveJsonToCache } from "./s3-cache";
import { logAiUsage } from "../ai/ai-usage-service";
import { ModelProviderResult } from "../ai/ai-key-provider";
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
  buildExtractionPromptTextLineItems,
} from "./prompt-builders";
import { AdditionalCategoryPrompt } from "./category-mapping-service";
import { addCategoriesToExtractionPrompt } from "./helpers/add-categories-to-extraction-prompt";
import { serializeLineItem } from "./helpers/serialize-line-item";

type HeaderResult = {
  header: Record<string, unknown>;
  selectedFolder?: string | null;
};

type ChunkLineItems = Record<string, Record<string, unknown>[]> | null;

interface ChunkExtractionResult {
  chunkResult: { lineItems: ChunkLineItems };
  fromCache: boolean;
}

/**
 * Multi-pass extraction orchestrator for text/CSV documents.
 *
 * Mirrors the visual `extractMultiPageDocumentData` pattern but runs over
 * "virtual pages" of a CSV instead of real PDF pages:
 *  - Step A: extract the header from the FULL text document
 *  - Step B: extract line items from each pre-built CSV chunk in parallel
 *            (each chunk already contains the table header row + a slice of
 *            data rows, so no page-scoping context is needed)
 *  - Step C: aggregate and dedupe line items across chunks
 */
export async function extractMultiPassTextDocumentData(params: {
  document: Document;
  documentType: DocumentTypeRecord;
  fullTextContent: string;
  virtualPages: string[];
  modelResult: ModelProviderResult;
  orgId: string;
  cachePrefix: string;
  additionalCategoryPrompt: AdditionalCategoryPrompt;
}): Promise<ExtractedDocumentData> {
  const {
    document,
    documentType,
    fullTextContent,
    virtualPages,
    modelResult,
    orgId,
    cachePrefix,
    additionalCategoryPrompt,
  } = params;
  const { id: documentId } = document;
  const startTime = Date.now();
  console.log(
    `[Multi-pass text extraction] Starting for document ${documentId}, docType=${documentType.name}, model=${modelResult.modelSlug}, chunks=${virtualPages.length}`
  );

  const { folderNamesMap, folderEnum, hasFolderMappings } =
    await buildFolderContext(documentType, orgId);

  console.log(
    `[Multi-pass text extraction] Running header and line items extraction in parallel`
  );

  const headerPromise = extractTextHeader({
    documentType,
    fullTextContent,
    hasFolderMappings,
    folderEnum,
    folderNamesMap,
    modelResult,
    documentId,
    orgId,
    cachePrefix,
  });

  const lineItemsPromise = extractAllChunkLineItems({
    documentType,
    virtualPages,
    modelResult,
    documentId,
    orgId,
    cachePrefix,
    additionalCategoryPrompt,
  });

  const [headerResult, allChunkLineItems] = await Promise.all([
    headerPromise,
    lineItemsPromise,
  ]);

  // Step C: Aggregate results
  console.log(
    `[Multi-pass text extraction] Step C: Aggregating results (removing duplicates across chunks)`
  );
  const mergedLineItems: Record<string, Record<string, unknown>[]> = {};
  // Track items seen in previous chunk extractions to deduplicate cross-chunk duplicates.
  // Within-chunk duplicates are intentionally preserved (same extraction = legitimate).
  const seenAcrossChunks: Record<string, Set<string>> = {};

  for (const chunkLineItems of allChunkLineItems) {
    for (const [collectionKey, items] of Object.entries(chunkLineItems)) {
      if (!mergedLineItems[collectionKey]) {
        mergedLineItems[collectionKey] = [];
        seenAcrossChunks[collectionKey] = new Set();
      }

      if (items && items.length > 0) {
        const seenSet = seenAcrossChunks[collectionKey];

        const newItems = items.filter(
          (item) => !seenSet.has(serializeLineItem(item))
        );
        const skippedCount = items.length - newItems.length;

        if (skippedCount > 0) {
          console.log(
            `[Multi-pass text extraction] Skipped ${skippedCount} duplicate item(s) in collection "${collectionKey}" (cross-chunk dedup)`
          );
        }

        mergedLineItems[collectionKey].push(...newItems);

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
    selectedFolder: headerResult.selectedFolder as string | undefined,
  };

  console.log(
    `[Multi-pass text extraction] Completed for document ${documentId}: headerFields=${Object.keys(extractedData.headerData).length}, lineItemCollections=${Object.keys(finalItemCounts).length}, totalItems=${Object.values(finalItemCounts).reduce((sum, count) => sum + count, 0)}, selectedFolder=${extractedData.selectedFolder ?? "null"}`
  );

  const duration = Date.now() - startTime;
  console.log(
    `[Multi-pass text extraction] Total duration: ${duration}ms`
  );

  return extractedData;
}

/**
 * Extracts header from the FULL text document.
 * Sends the document as a `{ type: "text" }` part (text/CSV - the model
 * doesn't need to OCR it, it just needs the textual content for context).
 */
async function extractTextHeader(params: {
  documentType: DocumentTypeRecord;
  fullTextContent: string;
  hasFolderMappings: boolean;
  folderEnum: [string, ...string[]];
  folderNamesMap: Record<string, string>;
  modelResult: ModelProviderResult;
  documentId: string;
  orgId: string;
  cachePrefix: string;
}): Promise<HeaderResult> {
  const {
    documentType,
    fullTextContent,
    hasFolderMappings,
    folderEnum,
    folderNamesMap,
    modelResult,
    documentId,
    orgId,
    cachePrefix,
  } = params;

  console.log(
    `[Multi-pass text extraction] Step A: Extracting header from full text document`
  );

  const headerCacheKey = `${cachePrefix}/header.json`;

  const cachedHeader = await getJsonFromCache<HeaderResult>(headerCacheKey);

  if (cachedHeader) {
    console.log(
      `[Multi-pass text extraction] Header cache **HIT** for document ${documentId}`
    );
    return cachedHeader;
  }

  console.log(
    `[Multi-pass text extraction] Header cache **MISS** for document ${documentId}`
  );

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

  // For text/CSV documents we send the content as a plain text part along
  // with the prompt - no need for the visual `{ type: "image" }` trick.
  const messageText = `${headerPrompt}\n\n## Document content\n\n${fullTextContent}`;

  const { object, usage: headerUsage, response } = await generateObject({
    model: modelResult.modelObj,
    providerOptions: modelResult.providerOptions,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: messageText }],
      },
    ],
    schema: headerResponseSchema,
    schemaName: "DocumentExtractionHeader",
    schemaDescription: `Extracted header data from a ${documentType.displayName} document`,
  });

  const headerResult = object;

  console.log(
    `[Multi-pass text extraction] Header extraction completed: tokens=${headerUsage.totalTokens}, selectedFolder=${headerResult.selectedFolder ?? "null"}`
  );

  if (!headerResult.header) {
    console.error(
      `[Multi-pass text extraction] Header extraction failed for document ${documentId}`
    );
    throw new Error(
      `Header extraction failed for document ${documentId}`
    );
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
      metadata: {
        documentId,
        step: "multi-pass-text-header",
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
 * Extracts line items from every CSV virtual page (chunk).
 * Each chunk is self-contained (header row + slice of data rows), so we
 * just pass the chunk text + a chunk-aware prompt.
 */
async function extractAllChunkLineItems(params: {
  documentType: DocumentTypeRecord;
  virtualPages: string[];
  modelResult: ModelProviderResult;
  documentId: string;
  orgId: string;
  cachePrefix: string;
  additionalCategoryPrompt: AdditionalCategoryPrompt;
}): Promise<Record<string, Record<string, unknown>[]>[]> {
  const {
    documentType,
    virtualPages,
    modelResult,
    documentId,
    orgId,
    cachePrefix,
    additionalCategoryPrompt,
  } = params;

  const chunkCount = virtualPages.length;
  console.log(
    `[Multi-pass text extraction] Step B: Extracting line items per chunk (${chunkCount} chunks)`
  );

  const lineItemsResponseSchema = buildLineItemsResponseSchema(
    documentType.lineItemSchemas!,
    additionalCategoryPrompt
  );

  const parallelExtraction =
    process.env.MULTIPAGE_EXTRACTION_PARALLEL_ENABLED === "true";

  const chunkExtractionTasks = virtualPages.map((chunkText, chunkIndex) => {
    const chunkNum = chunkIndex + 1;
    const chunkCacheKey = `${cachePrefix}/chunk-${chunkNum}.json`;

    let lineItemsPrompt = buildExtractionPromptTextLineItems(
      documentType.name,
      documentType.lineItemSchemas!,
      chunkNum,
      chunkCount
    );
    if (additionalCategoryPrompt.enumCategoryValues.length > 0) {
      lineItemsPrompt = addCategoriesToExtractionPrompt(
        lineItemsPrompt,
        additionalCategoryPrompt
      );
    }

    return {
      chunkNum,
      run: () =>
        extractChunkLineItems({
          chunkText,
          chunkNum,
          chunkCacheKey,
          lineItemsPrompt,
          lineItemsResponseSchema,
          modelResult,
          documentId,
          orgId,
          documentType,
        }),
    };
  });

  let settledResults: PromiseSettledResult<ChunkExtractionResult>[];

  if (parallelExtraction) {
    console.log(
      `[Multi-pass text extraction] Running ${chunkExtractionTasks.length} chunks in parallel`
    );
    settledResults = await Promise.allSettled(
      chunkExtractionTasks.map((t) => t.run())
    );
  } else {
    console.log(
      `[Multi-pass text extraction] Running ${chunkExtractionTasks.length} chunks sequentially`
    );
    settledResults = [];
    for (const task of chunkExtractionTasks) {
      settledResults.push(
        await task.run().then(
          (v) => ({ status: "fulfilled" as const, value: v }),
          (e) => ({ status: "rejected" as const, reason: e })
        )
      );
    }
  }

  const allChunkLineItems: Record<string, Record<string, unknown>[]>[] = [];
  let failedChunkCount = 0;
  let firstChunkError: unknown = null;

  for (let i = 0; i < settledResults.length; i++) {
    const settled = settledResults[i];
    const chunkNum = chunkExtractionTasks[i].chunkNum;

    if (settled.status === "rejected") {
      failedChunkCount++;
      if (!firstChunkError) firstChunkError = settled.reason;
      console.warn(
        `[Multi-pass text extraction] Chunk ${chunkNum} failed, skipping`,
        settled.reason
      );
      continue;
    }

    const { chunkResult, fromCache } = settled.value;
    const sourceInfo = fromCache ? "cached" : "extracted";

    if (chunkResult.lineItems) {
      const hasItems = Object.values(chunkResult.lineItems).some(
        (items) => Array.isArray(items) && items.length > 0
      );
      if (hasItems) {
        const itemCounts = Object.fromEntries(
          Object.entries(chunkResult.lineItems).map(([key, items]) => [
            key,
            Array.isArray(items) ? items.length : 0,
          ])
        );
        console.log(
          `[Multi-pass text extraction] Chunk ${chunkNum} completed (${sourceInfo}): items=${JSON.stringify(itemCounts)}`
        );
        allChunkLineItems.push(
          chunkResult.lineItems as Record<string, Record<string, unknown>[]>
        );
      } else {
        console.log(
          `[Multi-pass text extraction] Chunk ${chunkNum} completed (${sourceInfo}): no items found (skipped)`
        );
      }
    } else {
      console.log(
        `[Multi-pass text extraction] Chunk ${chunkNum} completed (${sourceInfo}): lineItems=null (skipped)`
      );
    }
  }

  console.log(
    `[Multi-pass text extraction] Chunk extraction completed: ${allChunkLineItems.length} chunks with items out of ${chunkCount} total chunks (${failedChunkCount} failed)`
  );

  if (failedChunkCount > 0) {
    console.error(
      `[Multi-pass text extraction] ${failedChunkCount}/${chunkCount} chunks failed for document ${documentId}, throwing to trigger retry (successful chunks are cached)`
    );
    throw (
      firstChunkError ??
      new Error(`${failedChunkCount}/${chunkCount} chunk extractions failed`)
    );
  }

  return allChunkLineItems;
}

/**
 * Extracts line items from a single CSV chunk.
 * Checks cache first, and if cache miss, calls AI to extract and caches the result.
 */
async function extractChunkLineItems(params: {
  chunkText: string;
  chunkNum: number;
  chunkCacheKey: string;
  lineItemsPrompt: string;
  lineItemsResponseSchema: z.ZodType<{
    lineItems: ChunkLineItems;
  }>;
  modelResult: ModelProviderResult;
  documentId: string;
  orgId: string;
  documentType: DocumentTypeRecord;
}): Promise<ChunkExtractionResult> {
  const {
    chunkText,
    chunkNum,
    chunkCacheKey,
    lineItemsPrompt,
    lineItemsResponseSchema,
    modelResult,
    documentId,
    orgId,
    documentType,
  } = params;

  const cachedChunk = await getJsonFromCache<{
    lineItems: ChunkLineItems;
  }>(chunkCacheKey);

  if (cachedChunk) {
    console.log(
      `[Multi-pass text extraction] Chunk ${chunkNum} cache **HIT** for document ${documentId}`
    );
    return {
      chunkResult: cachedChunk,
      fromCache: true,
    };
  }

  console.log(
    `[Multi-pass text extraction] Chunk ${chunkNum} cache **MISS** for document ${documentId}`
  );

  const messageText = `${lineItemsPrompt}\n\n## CSV chunk ${chunkNum}\n\n${chunkText}`;

  const { object, usage: chunkUsage, response } = await generateObject({
    model: modelResult.modelObj,
    providerOptions: modelResult.providerOptions,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: messageText }],
      },
    ],
    schema: lineItemsResponseSchema,
    schemaName: "DocumentExtractionLineItems",
    schemaDescription: `Extracted line items from chunk ${chunkNum} of a ${documentType.displayName} document`,
  });

  const chunkResult = object;

  await saveJsonToCache(chunkCacheKey, chunkResult);

  try {
    await logAiUsage({
      orgId,
      modelResult,
      usage: chunkUsage,
      responseObj: response,
      entityId: documentId,
      entityType: "DOCUMENT",
      metadata: {
        documentId,
        step: "multi-pass-text-lineItems",
        chunk: chunkNum,
        usage: chunkUsage,
      },
    });
  } catch (usageError) {
    console.error(
      `Failed to log AI usage for chunk ${chunkNum} extraction (document ${documentId}), continuing with extraction`,
      usageError
    );
  }

  return {
    chunkResult,
    fromCache: false,
  };
}
