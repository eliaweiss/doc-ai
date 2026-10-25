import crypto from "crypto";
import type { DocumentTypeRecord, FieldDefinition, FormulaCode } from "@zdocs/types";

const getFormulaCode = (f: FieldDefinition): string | undefined =>
  f.formula && "code" in f.formula ? (f.formula as FormulaCode).code : undefined;

const hashRelevantFields = (fields: FieldDefinition[]) =>
  fields
    .filter((f) => f.aiExtractable || getFormulaCode(f))
    .map((f) => {
      const code = getFormulaCode(f);
      return code ? { ...f, formulaCode: code } : f;
    });

/**
 * Generate a deterministic hash for the extraction schema
 */
export function generateSchemaHash(
  documentType: DocumentTypeRecord,
  modelSlug: string,
  categoryPromptHashValues: string[] = []
): string {
  const content = JSON.stringify({
    model: modelSlug,
    headerSchema: hashRelevantFields(documentType.headerSchema),
    lineItemSchemas: Object.fromEntries(
      Object.entries(documentType.lineItemSchemas || {}).map(([key, value]) => [
        key,
        hashRelevantFields(value.fields),
      ])
    ),
    extractVersion: process.env.EXTRACTION_VERSION || "1",
    folderMapping: documentType.folderMapping?.map(
      (f) => `${f.folderId}:${f.extractionHint}`
    ),
    categoryPrompt: categoryPromptHashValues,
  });
  return crypto.createHash("md5").update(content).digest("hex");
}
