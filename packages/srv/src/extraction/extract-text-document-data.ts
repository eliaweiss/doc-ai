import { generateObject } from "ai";
import { getAiExtractableFields } from "@zdocs/types";
import { getDocumentTypeByNameForOrg } from "@zdocs/db-schema";
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
import type { AdditionalCategoryPrompt } from "./category-mapping-service";
import { saveJsonToCache } from "./s3-cache";

import { addCategoriesToExtractionPrompt } from "./helpers/add-categories-to-extraction-prompt";
import { decodeTextBuffer } from "./helpers/decode-text-buffer";
import { preprocessCsvTable } from "./helpers/preprocess-csv-table";
import { splitCsvRecords } from "./helpers/split-csv-records";
import { splitCsvVirtualPages } from "./helpers/split-csv-virtual-pages";
import { extractMultiPassTextDocumentData } from "./extract-multi-pass-text-document-data";

type ExtractDocumentType = NonNullable<
  Awaited<ReturnType<typeof getDocumentTypeByNameForOrg>>
>;

const DEFAULT_MULTIPASS_TRIGGER_ROW_COUNT = 50;

function getMultiPassTriggerRowCount(): number {
  const raw = process.env.TRIGGER_MULTIPAGE_EXTRACTION_ROW_COUNT;
  if (!raw) return DEFAULT_MULTIPASS_TRIGGER_ROW_COUNT;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MULTIPASS_TRIGGER_ROW_COUNT;
  }
  return parsed;
}

/**
 * Multi-pass (virtual page) extraction is row-table specific - it only makes
 * sense for CSV-shaped data. Plain text (`text/plain`) is unstructured prose
 * and must always go through single-pass so the AI can reason over the full
 * document at once.
 */
function isCsvContentType(contentType: string): boolean {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  return normalized === "text/csv" || normalized === "application/csv";
}

export async function extractTextDocumentData(params: {
  document: ExtractDocumentDataParams["document"];
  documentType: ExtractDocumentType;
  textBuffer: Buffer;
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
    modelResult,
    documentType,
    textBuffer,
    orgId,
    documentId,
    contentType,
    cachePrefix,
    cacheKey,
    additionalCategoryPrompt,
  } = params;

  const { text: textContent, encoding } = decodeTextBuffer(textBuffer);
  if (encoding !== "utf-8") {
    console.log(
      `[Text extraction] Decoded document ${documentId} text buffer as ${encoding}`
    );
  }
  const triggerRowCount = getMultiPassTriggerRowCount();
  const isCsv = isCsvContentType(contentType);
  const csvRecords = isCsv ? splitCsvRecords(textContent) : null;
  const totalRowCount = csvRecords
    ? csvRecords.length
    : textContent.split("\n").length;
  if (csvRecords) {
    const physicalLineCount = textContent.split("\n").length;
    if (physicalLineCount !== csvRecords.length) {
      console.log(
        `[Text extraction] CSV quote-aware records=${csvRecords.length} physicalLines=${physicalLineCount} for document ${documentId}`
      );
    }
  }
  const hasLineItemSchemas =
    !!documentType.lineItemSchemas &&
    Object.keys(documentType.lineItemSchemas).length > 0;

  if (isCsv && hasLineItemSchemas && totalRowCount > triggerRowCount) {
    console.log(
      `[Multi-pass text extraction] Triggering multi-pass for document ${documentId}: rowCount=${totalRowCount} > trigger=${triggerRowCount}`
    );

    const tables = await preprocessCsvTable({
      textContent,
      modelResult,
      documentId,
      orgId,
      cachePrefix,
    });

    const lines = csvRecords ?? splitCsvRecords(textContent);
    const rowsPerPage = Math.max(1, Math.floor(triggerRowCount / 2));

    const allVirtualPages: string[] = [];
    let totalDataRowsAcrossAllTables = 0;

    for (let tableIdx = 0; tableIdx < tables.length; tableIdx++) {
      const table = tables[tableIdx];
      const { virtualPages, totalDataRows, headerLine } =
        splitCsvVirtualPages({
          lines,
          tableStartLine: table.tableStartLine,
          tableEndLine: table.tableEndLine,
          rowsPerPage,
        });

      console.log(
        `[Multi-pass text extraction] Document ${documentId}, table ${tableIdx + 1}/${tables.length}: tableHeaders=${JSON.stringify(table.tableHeaders)}, headerLine="${headerLine}", dataRows=${totalDataRows}, virtualPages=${virtualPages.length}`
      );

      allVirtualPages.push(...virtualPages);
      totalDataRowsAcrossAllTables += totalDataRows;
    }

    console.log(
      `[Multi-pass text extraction] Document ${documentId}: ${tables.length} table(s), totalDataRows=${totalDataRowsAcrossAllTables}, rowsPerPage=${rowsPerPage}, totalVirtualPages=${allVirtualPages.length}`
    );

    if (allVirtualPages.length === 0) {
      console.warn(
        `[Multi-pass text extraction] Document ${documentId}: 0 virtual pages produced across ${tables.length} table(s), falling back to single-pass`
      );
    } else {
      const extractedData = await extractMultiPassTextDocumentData({
        document,
        documentType,
        fullTextContent: textContent,
        virtualPages: allVirtualPages,
        modelResult,
        orgId,
        cachePrefix,
        additionalCategoryPrompt,
      });

      await saveJsonToCache(cacheKey, extractedData);

      return extractedData;
    }
  }

  // Single-pass extraction: send CSV/text as text, never as a fake image.
  console.log(
    `[Single-pass extraction] Using text extraction path for document ${documentId} (contentType=${contentType}, isCsv=${isCsv}, rowCount=${totalRowCount}, trigger=${triggerRowCount}, hasLineItems=${hasLineItemSchemas})`
  );
  const aiHeaderFields = getAiExtractableFields(documentType.headerSchema);
  const headerZodSchema = buildZodSchema(aiHeaderFields);

  const { folderNamesMap, folderEnum, hasFolderMappings } =
    await buildFolderContext(documentType, orgId);

  const responseSchema = buildFullResponseSchema(
    headerZodSchema,
    documentType.lineItemSchemas,
    hasFolderMappings,
    folderEnum,
    additionalCategoryPrompt
  );

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

  const messageText = `${prompt}\n\n## Document content\n\n${textContent}`;

  const startTime = Date.now();
  const { object, usage, response } = await generateObject({
    model: modelResult.modelObj,
    providerOptions: modelResult.providerOptions,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: messageText }],
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

  try {
    await logAiUsage({
      orgId,
      modelResult,
      usage,
      responseObj: response,
      entityId: documentId,
      entityType: "DOCUMENT",
      metadata: {
        documentId,
        usage,
      },
    });
  } catch (usageError) {
    console.error(
      `Failed to log AI usage for single-pass extraction (document ${documentId}), continuing`,
      usageError
    );
  }

  await saveJsonToCache(cacheKey, extractedData);

  return extractedData;
}
