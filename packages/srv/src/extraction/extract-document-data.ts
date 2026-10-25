import {
  fetchDocumentFromS3,
  getJsonFromCache,
  deleteCacheByPrefix,
} from "./s3-cache";
import { getDocumentTypeByNameForOrg } from "@zdocs/db-schema";
import { getModelProviderForOrg } from "../ai/ai-key-provider";
import type { ExtractedDocumentData, ExtractDocumentDataParams, ExtractDocumentDataResult } from "./types";
import { generateSchemaHash } from "./schema-hash";
import { AdditionalCategoryPrompt, Category } from "./category-mapping-service";
import { extractVisualDocumentData } from "./extract-visual-document-data";
import { extractTextDocumentData } from "./extract-text-document-data";
import { logExtractionPricingModel } from "./helpers/log-extraction-pricing-model";
import { validateDocumentUploadSize } from "../storage/file-utils";

/**
 * Extract document data using AI Vision with schema-driven prompts.
 * Uses the document IMAGE directly (not OCR text) for better accuracy with tables and layout.
 * Uses S3 caching to avoid redundant LLM calls.
 *
 * This function:
 * 1. Fetches the document type by docType
 * 2. Checks S3 cache (avoids fetching document if cached)
 * 3. Only fetches document from S3 on cache miss
 * 4. Calls AI Vision for extraction
 *
 * @param params - Extraction parameters
 * @param params.document - The document object (contains S3 location, orgId, docType, etc.)
 * @returns The extracted data and the resolved document type
 */
export async function extractDocumentData(
  params: ExtractDocumentDataParams
): Promise<ExtractDocumentDataResult> {
  const { document, forceReExtract } = params;
  const { orgId, id: documentId, contentType } = document;

  // 4. Fetch categories prompt from S3
  const rawCategories = await getJsonFromCache<unknown>(
    `categories-prompt/${documentId}.json`
  );
  const categories = normalizeCategories(rawCategories);

  const categoryTextList = categories
    .map((cat) => `- ${cat.name}: ${cat.description || cat.name}`)
    .join("\n");

  const enumCategoryValues = categories.map((cat) => cat.name);
  const additionalCategoryPrompt: AdditionalCategoryPrompt = {
    categoryTextList,
    enumCategoryValues,
  };
  const categoryPromptHashValues = categories.map(
    (cat) => `${cat.name}:${cat.description || ""}`
  );

  // 1. Get the document type schema (org-scoped)
  if (!document.docType) {
    throw new Error("Document has no docType - classification may have failed");
  }
  const documentType = await getDocumentTypeByNameForOrg(
    document.docType,
    orgId
  );
  if (!documentType) {
    throw new Error(
      `Document type not found: ${document.docType} for org ${orgId}`
    );
  }

  console.log(
    `Extracting ${documentType.name} data for document: ${documentId} using Vision API`
  );

  let modelResult = await getModelProviderForOrg(orgId, "EXTRACT_DOCUMENT");
  logExtractionPricingModel("Initial model selection", documentId, modelResult);

  const docHash = document.contentHash || document.s3Key;
  const schemaHash = generateSchemaHash(
    documentType,
    modelResult.modelSlug,
    categoryPromptHashValues
  );
  const cachePrefix = `extraction/${docHash}/${schemaHash}`;
  const cacheKey = `${cachePrefix}/result.json`;

  // SKIP_CACHE means fresh uploads clear extraction caches before reading them.
  // Retries still read cache so successful pages/chunks survive transient errors.
  const shouldClearCache =
    forceReExtract || (process.env.SKIP_CACHE === "true" && !params.isRetry);
  if (shouldClearCache) {
    const reason = forceReExtract ? "force re-extraction" : "fresh upload";
    console.log(`Extraction cache clear requested (${reason}): ${docHash}/${schemaHash}`);
    const deletedCount = await deleteCacheByPrefix(`${cachePrefix}/`);
    console.log(`Deleted ${deletedCount} cached objects under prefix: ${cachePrefix}/`);
  }

  // Check cache FIRST - retries depend on this to reuse successfully extracted pages.
  const cached = await getJsonFromCache<ExtractedDocumentData>(cacheKey);
  if (cached) {
    console.log(`Extraction cache **HIT**`);
    return { documentType, extractedData: cached };
  }
  console.log(`Extraction cache **MISS**`);

  if (isTextExtractionContentType(contentType)) {
    // Cache miss - fetch text document from S3
    const textBuffer = await fetchDocumentFromS3(
      document.s3Bucket,
      document.s3Key,
      document.s3Region
    );
    await validateDocumentUploadSize(textBuffer, contentType);

    const extractedData = await extractTextDocumentData({
      document,
      documentType,
      textBuffer,
      modelResult,
      orgId,
      documentId,
      contentType,
      cachePrefix,
      cacheKey,
      additionalCategoryPrompt,
    });

    return { documentType, extractedData };
  }

  // Cache miss - fetch visual document from S3
  const imageBuffer = await fetchDocumentFromS3(
    document.s3Bucket,
    document.s3Key,
    document.s3Region
  );
  await validateDocumentUploadSize(imageBuffer, contentType);

  const extractedData = await extractVisualDocumentData({
    document,
    documentType,
    imageBuffer,
    modelResult,
    orgId,
    documentId,
    contentType,
    cachePrefix,
    cacheKey,
    additionalCategoryPrompt,
  });

  return { documentType, extractedData };
}

function isTextExtractionContentType(contentType: string): boolean {
  const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase();

  return (
    normalizedContentType === "text/csv" ||
    normalizedContentType === "text/plain" ||
    normalizedContentType === "application/csv"
  );
}

function normalizeCategories(rawCategories: unknown): Category[] {
  if (!Array.isArray(rawCategories)) {
    return [];
  }

  const dedupeByName = new Set<string>();
  const categories: Category[] = [];

  for (const category of rawCategories) {
    if (!category || typeof category !== "object") {
      continue;
    }

    const name =
      "name" in category && typeof category.name === "string"
        ? category.name.trim()
        : "";
    if (!name || dedupeByName.has(name)) {
      continue;
    }

    const description =
      "description" in category && typeof category.description === "string"
        ? category.description.trim()
        : "";

    categories.push({ name, description });
    dedupeByName.add(name);
  }

  return categories;
}

