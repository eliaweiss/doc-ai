import { generateObject } from "ai";
import { z } from "zod";
import type { DocumentTypeRecord } from "@zdocs/types";
import { getJsonFromCache, saveJsonToCache } from "./s3-cache";
import { logAiUsage } from "../ai/ai-usage-service";
import { ModelProviderResult } from "../ai/ai-key-provider";

export interface ExtractPageLineItemsParams {
  documentDataUrl: string;
  pageNum: number;
  pageCacheKey: string;
  lineItemsPrompt: string;
  lineItemsResponseSchema: z.ZodType<{
    lineItems: Record<string, Record<string, unknown>[]> | null;
  }>;
  modelResult: ModelProviderResult;
  documentId: string;
  orgId: string;
  documentType: DocumentTypeRecord;
}

export interface ExtractPageLineItemsResult {
  pageResult: {
    lineItems: Record<string, Record<string, unknown>[]> | null;
  };
  fromCache: boolean;
}

/**
 * Extracts line items from a single page of a document.
 * Checks cache first, and if cache miss, calls AI to extract and caches the result.
 */
export async function extractPageLineItems(
  params: ExtractPageLineItemsParams
): Promise<ExtractPageLineItemsResult> {
  const {
    documentDataUrl,
    pageNum,
    pageCacheKey,
    lineItemsPrompt,
    lineItemsResponseSchema,
    modelResult,
    documentId,
    orgId,
    documentType,
  } = params;

  const cachedPage = await getJsonFromCache<{
    lineItems: Record<string, Record<string, unknown>[]> | null;
  }>(pageCacheKey);

  if (cachedPage) {
    console.log(
      `[Multi-page extraction] Page ${pageNum} cache **HIT** for document ${documentId}`
    );
    return {
      pageResult: cachedPage,
      fromCache: true,
    };
  }

  console.log(
    `[Multi-page extraction] Page ${pageNum} cache **MISS** for document ${documentId}`
  );

  const { object, usage: pageUsage, response } = await generateObject({
    model: modelResult.modelObj,
    providerOptions: modelResult.providerOptions,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: documentDataUrl },
          { type: "text", text: lineItemsPrompt },
        ],
      },
    ],
    schema: lineItemsResponseSchema,
    schemaName: "DocumentExtractionLineItems",
    schemaDescription: `Extracted line items from page ${pageNum} of a ${documentType.displayName} document`,
  });

  const pageResult = object;

  // Save page to cache immediately after successful extraction
  await saveJsonToCache(pageCacheKey, pageResult);

  // Log AI usage for each page extraction (logging failures should not fail extraction)
  try {
    await logAiUsage({
      orgId,
      modelResult,
      usage: pageUsage,
      responseObj: response,
      entityId: documentId,
      entityType: "DOCUMENT",
      pageNumber: pageNum,
      pageCount: 1,
      metadata: {
        documentId,
        step: "multi-page-lineItems",
        page: pageNum,
        pageCount: 1,
        usage: pageUsage,
      },
    });
  } catch (usageError) {
    console.error(
      `Failed to log AI usage for page ${pageNum} extraction (document ${documentId}), continuing with extraction`,
      usageError
    );
  }

  return {
    pageResult,
    fromCache: false,
  };
}
