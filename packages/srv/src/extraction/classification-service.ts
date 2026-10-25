import { z } from "zod";
import crypto from "crypto";
import { generateObject } from "ai";
import type { DocumentTypeRecord } from "@zdocs/types";
import { getJsonFromCache, saveJsonToCache } from "./s3-cache";
import { logAiUsage } from "../ai/ai-usage-service";
import { getModelProviderForOrg } from "../ai/ai-key-provider";

const CLASSIFICATION_VERSION = "2";

/**
 * Result of classifying a document with the new unified schema
 */
export interface UnifiedClassificationResult {
  /** The document type name (e.g., "INVOICE") */
  docType: string;
  /** A brief descriptive title for this document */
  title: string | null;
  /** The main monetary amount (if applicable) */
  totalAmount: number | null;
  /** The primary date of the document (in ISO format YYYY-MM-DD) */
  date: string | null;
}

/**
 * Build the classification prompt for available document types
 */
function buildUnifiedClassificationPrompt(types: DocumentTypeRecord[]): string {
  const typeList = types
    .map((t) => {
      var description = `- ${t.name}: ${t.description || t.displayName}`;
      if (t.extractionHint) {
        description += ` (extraction hint: ${t.extractionHint})`;
      }
      return description;
    })
    .join("\n");

  return `Analyze this document image and classify it.

Available document types:
${typeList}

Determine:
1. documentTypeName: Which of the above document types best matches this document? Return the exact type name (e.g., "INVOICE", "RECEIPT").
2. title: A brief descriptive title for this document
3. totalAmount: The main monetary amount (if applicable, as a number)
4. date: The primary date of the document (in ISO format YYYY-MM-DD)

If any field cannot be determined, return null for that field.`;
}

/**
 * Generate a deterministic hash for the unified classification prompt
 * Includes version to invalidate cache when switching from OCR to image-based
 */
function generateUnifiedPromptHash(types: DocumentTypeRecord[], modelSlug: string): string {
  const typeNames = types
    .map((t) => t.name)
    .sort()
    .join(",");
  // v2: switched from OCR text to direct image classification
  const content = `${modelSlug}|unified_classification_v2_image|${typeNames}|version:${CLASSIFICATION_VERSION}`;
  return crypto.createHash("md5").update(content).digest("hex");
}

export interface ClassifyDocumentWithTypesParams {
  docHash: string;
  /** The document image buffer */
  imageBuffer: Buffer;
  /** MIME type of the document (e.g., "application/pdf", "image/png") */
  contentType: string;
  availableTypes: DocumentTypeRecord[];
  /** Organization ID for usage logging */
  orgId: string;
  /** Document ID for usage logging */
  documentId: string;
}

/**
 * Classify a document using AI Vision with the unified schema.
 * Uses the document IMAGE directly (not OCR text) for better accuracy and cost efficiency.
 *
 * @param params - Classification parameters
 * @param params.docHash - Hash of the document content (for caching)
 * @param params.imageBuffer - The document image buffer
 * @param params.contentType - MIME type of the document
 * @param params.availableTypes - Available document types for this org
 * @param params.orgId - Organization ID for usage logging
 * @param params.documentId - Document ID for usage logging
 */
export async function classifyDocumentWithTypes(
  params: ClassifyDocumentWithTypesParams
): Promise<UnifiedClassificationResult> {
  const {
    docHash,
    imageBuffer,
    contentType,
    availableTypes,
    orgId,
    documentId,
  } = params;

  // Get org-specific model provider for CLASSIFY_DOCUMENT action
  const model = await getModelProviderForOrg(orgId, "CLASSIFY_DOCUMENT");
  const promptHash = generateUnifiedPromptHash(availableTypes, model.modelSlug);
  const cacheKey = `classification/${docHash}/${promptHash}.json`;

  // Check cache FIRST - re-uploads get a fresh key through the document hash.
  const cached = await getJsonFromCache<UnifiedClassificationResult>(cacheKey);
  if (cached) {
    console.log(`Unified classification cache **HIT**`);
    console.log(`[Classification Cache] Cached data:`, JSON.stringify(cached));

    // Validate cached data has required fields
    if (!cached.docType) {
      console.warn(
        `[Classification Cache] Invalid cache entry - missing docType, will re-classify`
      );
      // Don't return - fall through to re-classify
    } else {
      return cached;
    }
  }

  console.log(`Unified classification cache **MISS**`);

  // Build dynamic schema with available type names
  const typeNames = availableTypes.map((t) => t.name);
  const unifiedSchema = z.object({
    documentTypeName: z.enum(typeNames as [string, ...string[]]),
    title: z.string().nullable(),
    totalAmount: z.number().nullable(),
    date: z.string().nullable(),
  });

  // Convert buffer to base64 data URL for vision API
  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;

  // Call AI Vision
  const prompt = buildUnifiedClassificationPrompt(availableTypes);
  console.log("[Classification] Prompt:", prompt);
  const { object, usage, response } = await generateObject({
    model: model.modelObj,
    providerOptions: model.providerOptions,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: dataUrl },
          { type: "text", text: prompt },
        ],
      },
    ],
    schema: unifiedSchema,
    schemaName: "UnifiedClassification",
    schemaDescription: "Classification of a document with type ID",
  });

  // Log AI usage (awaited to ensure it completes before serverless function terminates)
  await logAiUsage({
    orgId,
    modelResult: model,
    usage,
    responseObj: response,
    entityId: documentId,
    entityType: "DOCUMENT",
  });

  // Find the docType for the classified type name
  const matchedType = availableTypes.find(
    (t) => t.name === object.documentTypeName
  );
  if (!matchedType) {
    throw new Error(
      `AI returned unknown document type: ${object.documentTypeName}`
    );
  }

  const result: UnifiedClassificationResult = {
    docType: matchedType.name,
    title: object.title,
    totalAmount: object.totalAmount,
    date: object.date,
  };

  // Save to cache
  await saveJsonToCache(cacheKey, result);

  return result;
}
