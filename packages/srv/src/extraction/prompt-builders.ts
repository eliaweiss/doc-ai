import type {
  FieldDefinition,
  LineItemCollectionSchema,
  FolderMapping,
} from "@zdocs/types";
import { getAiExtractableFields } from "@zdocs/types";
import { fieldTypeToJsonType } from "./zod-schema-builder";

const DATE_EXTRACTION_INSTRUCTION =
  "When extracting dates, always assume the year is the rightmost numeric segment. For example, 25.04.26 is DD-MM-YY and must be parsed as 2026-04-25.";

/**
 * Builds extraction prompt from schema
 * Only includes AI-extractable fields
 */
export function buildExtractionPrompt(
  documentTypeName: string,
  headerSchema: FieldDefinition[],
  lineItemSchemas?: Record<string, LineItemCollectionSchema> | null,
  folderMapping?: FolderMapping[] | null,
  folderNames?: Record<string, string>
): string {
  let prompt = `Today is ${new Date().toISOString()} - if date is partial, always assume it is this year.
${DATE_EXTRACTION_INSTRUCTION}
   Extract data from this ${documentTypeName} document.\n\n`;

  // Folder selection if mappings exist
  if (folderMapping && folderMapping.length > 0 && folderNames) {
    prompt += `## Folder Classification\n`;
    prompt += `This document should be filed into one of the following folders based on the content and these rules:\n\n`;

    for (const mapping of folderMapping) {
      const folderName = folderNames[mapping.folderId] || mapping.folderId;
      prompt += `- **${folderName}**: ${mapping.extractionHint}\n`;
    }
    prompt += `- **NONE**: Use this if none of the above rules match clearly.\n\n`;
    prompt += `Select the best matching folder name for the "selectedFolder" field.\n\n`;
  }

  // Header fields (only AI-extractable ones)
  const aiHeaderFields = getAiExtractableFields(headerSchema);
  prompt += `## Header Fields\n`;
  prompt += `Extract the following fields from the document:\n\n`;

  for (const field of aiHeaderFields) {
    prompt += `- **${field.name}** (${fieldTypeToJsonType(field.type)})`;
    if (field.description) prompt += `: ${field.description}`;
    if (field.extractionHint) prompt += ` [Hint: ${field.extractionHint}]`;
    prompt += `\n`;
  }

  // Line item collections
  if (lineItemSchemas && Object.keys(lineItemSchemas).length > 0) {
    prompt += `\n## Tabular Data Collections\n`;
    prompt += `This document contains tables/lists. Extract each separately:\n\n`;

    for (const [zdocsTypeKey, collection] of Object.entries(lineItemSchemas)) {
      const aiFields = getAiExtractableFields(collection.fields);
      if (aiFields.length === 0) continue;

      prompt += `### ${collection.displayName} (key: "${zdocsTypeKey}")\n`;
      if (collection.description) {
        prompt += `${collection.description}\n`;
      }
      prompt += `Extract each item with:\n`;

      for (const field of aiFields) {
        prompt += `- **${field.name}** (${fieldTypeToJsonType(field.type)})`;
        if (field.description) prompt += `: ${field.description}`;
        if (field.extractionHint) prompt += ` [Hint: ${field.extractionHint}]`;
        prompt += `\n`;
      }
      prompt += `\n`;
    }
  }

  // Output format
  prompt += `\n## Output Format\n`;
  prompt += `Return a JSON object with:\n`;
  prompt += `- "header": object with header fields\n`;

  if (lineItemSchemas && Object.keys(lineItemSchemas).length > 0) {
    prompt += `- "lineItems": object with named collections:\n`;
    for (const zdocsTypeKey of Object.keys(lineItemSchemas)) {
      prompt += `  - "${zdocsTypeKey}": array of objects\n`;
    }
  }

  prompt += `\nUse null for any field that cannot be extracted.\n`;
  prompt += `Use empty array [] for collections with no items found.\n`;
  prompt += `If currency is not specified, guesstimate from the document language, for example, hebrew documents are in ILS.\n`;

  return prompt;
}

/**
 * Builds extraction prompt for headers only (multi-page path)
 * Includes folder classification and header fields, excludes line items
 */
export function buildExtractionPromptHeaders(
  documentTypeName: string,
  headerSchema: FieldDefinition[],
  folderMapping?: FolderMapping[] | null,
  folderNames?: Record<string, string>
): string {
  let prompt = `Today is ${new Date().toISOString()} - if date is partial, always assume it is this year.
${DATE_EXTRACTION_INSTRUCTION}
   Extract header data from this ${documentTypeName} document.\n\n`;

  // Folder selection if mappings exist
  if (folderMapping && folderMapping.length > 0 && folderNames) {
    prompt += `## Folder Classification\n`;
    prompt += `This document should be filed into one of the following folders based on the content and these rules:\n\n`;

    for (const mapping of folderMapping) {
      const folderName = folderNames[mapping.folderId] || mapping.folderId;
      prompt += `- **${folderName}**: ${mapping.extractionHint}\n`;
    }
    prompt += `- **NONE**: Use this if none of the above rules match clearly.\n\n`;
    prompt += `Select the best matching folder name for the "selectedFolder" field.\n\n`;
  }

  // Header fields (only AI-extractable ones)
  const aiHeaderFields = getAiExtractableFields(headerSchema);
  prompt += `## Header Fields\n`;
  prompt += `Extract the following fields from the document:\n\n`;

  for (const field of aiHeaderFields) {
    prompt += `- **${field.name}** (${fieldTypeToJsonType(field.type)})`;
    if (field.description) prompt += `: ${field.description}`;
    if (field.extractionHint) prompt += ` [Hint: ${field.extractionHint}]`;
    prompt += `\n`;
  }

  // Output format
  prompt += `\n## Output Format\n`;
  prompt += `Return a JSON object with:\n`;
  prompt += `- "header": object with header fields\n`;
  if (folderMapping && folderMapping.length > 0) {
    prompt += `- "selectedFolder": folder name or null\n`;
  }

  prompt += `\nUse null for any field that cannot be extracted.\n`;
  prompt += `If currency is not specified, guesstimate from the document language, for example, hebrew documents are in ILS.\n`;

  return prompt;
}

/**
 * Builds extraction prompt for line items only (multi-page path)
 * Includes only line item collections, excludes header and folder sections
 * @param pageNum - The page number to extract from (1-indexed)
 * @param totalPages - Total number of pages in the document
 */
export function buildExtractionPromptLineItems(
  documentTypeName: string,
  lineItemSchemas: Record<string, LineItemCollectionSchema>,
  pageNum: number,
  totalPages: number
): string {
  let prompt = `Today is ${new Date().toISOString()} - if date is partial, always assume it is this year.
${DATE_EXTRACTION_INSTRUCTION}
   Extract line items from this ${documentTypeName} document.\n\n`;

  // Line item collections
  prompt += `## Tabular Data Collections\n`;
  prompt += `This document contains tables/lists. Extract each separately:\n\n`;

  for (const [zdocsTypeKey, collection] of Object.entries(lineItemSchemas)) {
    const aiFields = getAiExtractableFields(collection.fields);
    if (aiFields.length === 0) continue;

    prompt += `### ${collection.displayName} (key: "${zdocsTypeKey}")\n`;
    if (collection.description) {
      prompt += `${collection.description}\n`;
    }
    prompt += `Extract each item with:\n`;

    for (const field of aiFields) {
      prompt += `- **${field.name}** (${fieldTypeToJsonType(field.type)})`;
      if (field.description) prompt += `: ${field.description}`;
      if (field.extractionHint) prompt += ` [Hint: ${field.extractionHint}]`;
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  // Page-specific extraction scope instructions
  prompt += `\n## Page-Specific Extraction Scope\n\n`;
  prompt += `This is a multi-page document (${totalPages} total pages). You must extract line items **from page ${pageNum}**.\n\n`;
  prompt += `- You are receiving the complete document for context. Return every line item that appears on page ${pageNum}, including the very first and very last row on the page.\n`;
  prompt += `- The most common mistake is silently skipping the topmost or bottommost row of a page (e.g. because it looks like it "belongs" to the month/table shown on an adjacent page). Do NOT do this - a row belongs to whichever page it is visually printed on, regardless of which month or table section it continues.\n`;
  prompt += `- Each page is being processed in a separate query, and cross-page duplicates are automatically detected and removed afterwards. Because of this, omitting a real row is a much worse error than including an extra duplicate row.\n`;
  prompt += `- If you are unsure whether a row near the top or bottom edge of page ${pageNum} belongs to this page or an adjacent one, INCLUDE it anyway.\n`;
  prompt += `- DO use other pages for context when needed (e.g., column headers that appear only on an earlier page, or understanding data that spans a page break).\n`;
  if (pageNum > 1) {
    prompt += `- Safety overlap: also include the last 5 line items visible on page ${pageNum - 1}, even though they are not this page's own rows.\n`;
  }
  if (pageNum < totalPages) {
    prompt += `- Safety overlap: also include the first 5 line items visible on page ${pageNum + 1}, even though they are not this page's own rows.\n`;
  }
  prompt += `- Before returning your answer, re-check the top edge and bottom edge of page ${pageNum} specifically for a row that might have been cut off or overlooked.\n`;
  prompt += `- Multiple rows can share the same date, description, and even similar amounts (e.g. several small transfers on the same day). These are still separate rows - extract EACH one individually. Never assume a row is a duplicate and skip it just because a nearby row looks similar; only true cross-page repeats are duplicates, and those are deduplicated downstream automatically.\n`;
  prompt += `- Count the visible rows on page ${pageNum} before finalizing your answer, and make sure your returned array(s) account for every one of them (plus any overlap rows requested above).\n`;
  prompt += `- If page ${pageNum} contains no line items (e.g., it is a cover page or contains only header/footer info), return empty arrays for all collections unless the overlap rows above apply.\n`;

  // Output format
  prompt += `\n## Output Format\n`;
  prompt += `Return a JSON object with:\n`;
  prompt += `- "lineItems": object with named collections:\n`;
  for (const zdocsTypeKey of Object.keys(lineItemSchemas)) {
    prompt += `  - "${zdocsTypeKey}": array of objects\n`;
  }

  prompt += `\nUse null for any field that cannot be extracted.\n`;
  prompt += `Use empty array [] for collections with no items found on page ${pageNum}.\n`;

  // console.log("-------------------------------- buildExtractionPromptLineItems --------------------------------");
  // console.log(prompt);
  // console.log("-------------------------------- buildExtractionPromptLineItems --------------------------------");
  return prompt;
}

/**
 * Builds extraction prompt for line items from a CSV chunk (text multi-pass path)
 *
 * Each chunk is a self-contained CSV with the table header row at the top
 * followed by a slice of data rows. Unlike the visual multi-page path, there
 * is no need for page-scoping instructions because each chunk only contains
 * its own rows.
 */
export function buildExtractionPromptTextLineItems(
  documentTypeName: string,
  lineItemSchemas: Record<string, LineItemCollectionSchema>,
  chunkNum: number,
  totalChunks: number
): string {
  let prompt = `Today is ${new Date().toISOString()} - if date is partial, always assume it is this year.
${DATE_EXTRACTION_INSTRUCTION}
   Extract line items from this ${documentTypeName} document.\n\n`;

  prompt += `## Tabular Data Collections\n`;
  prompt += `This document contains tables/lists. Extract each separately:\n\n`;

  for (const [zdocsTypeKey, collection] of Object.entries(lineItemSchemas)) {
    const aiFields = getAiExtractableFields(collection.fields);
    if (aiFields.length === 0) continue;

    prompt += `### ${collection.displayName} (key: "${zdocsTypeKey}")\n`;
    if (collection.description) {
      prompt += `${collection.description}\n`;
    }
    prompt += `Extract each item with:\n`;

    for (const field of aiFields) {
      prompt += `- **${field.name}** (${fieldTypeToJsonType(field.type)})`;
      if (field.description) prompt += `: ${field.description}`;
      if (field.extractionHint) prompt += ` [Hint: ${field.extractionHint}]`;
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  prompt += `\n## CSV Chunk Extraction Scope\n\n`;
  prompt += `You are receiving chunk ${chunkNum} of ${totalChunks} from a larger CSV/text document.\n`;
  prompt += `- The first row of the chunk below is the table column header row (carried over from the original document).\n`;
  prompt += `- All remaining rows are data rows that belong to this chunk.\n`;
  prompt += `- Extract every data row in this chunk as a line item. Do NOT skip any rows.\n`;
  prompt += `- Do NOT extract the header row itself as a line item.\n`;
  prompt += `- This chunk is processed independently from the others; do not try to reference rows from other chunks.\n`;

  prompt += `\n## Output Format\n`;
  prompt += `Return a JSON object with:\n`;
  prompt += `- "lineItems": object with named collections:\n`;
  for (const zdocsTypeKey of Object.keys(lineItemSchemas)) {
    prompt += `  - "${zdocsTypeKey}": array of objects\n`;
  }

  prompt += `\nUse null for any field that cannot be extracted from a given row.\n`;
  prompt += `Use empty array [] for collections with no matching rows in this chunk.\n`;

  return prompt;
}
