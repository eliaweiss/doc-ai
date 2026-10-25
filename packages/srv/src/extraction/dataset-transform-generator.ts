import { z } from "zod";
import { generateObject } from "ai";
import { logAiUsage } from "../ai/ai-usage-service";
import {
  getModelProviderForOrg,
  AiKeyError,
  detectAndConvertApiKeyError,
} from "../ai/ai-key-provider";

// Schema for AI-generated field definitions
const fieldDefinitionSchema = z.object({
  name: z
    .string()
    .describe(
      "camelCase field name in ENGLISH (e.g., 'description', 'transactionDate', 'amount')"
    ),
  displayName: z
    .string()
    .describe(
      "Exact header text from the file (preserve original language/format)"
    ),
  type: z
    .enum(["text", "number", "currency", "date", "boolean"])
    .describe("Field data type"),
  currencyField: z
    .string()
    .optional()
    .describe("For currency fields: name of companion currency code field"),
  description: z.string().optional().describe("Brief description of the field"),
});

// Schema for AI response
const transformResponseSchema = z.object({
  datasetName: z.string().describe("Suggested name for this dataset type"),
  skipRows: z
    .number()
    .describe(
      "Number of rows to skip before the header row (0 if first row is header)"
    ),
  delimiter: z
    .enum([",", ";", "\t"])
    .describe("Field delimiter used in the file"),
  schema: z
    .array(fieldDefinitionSchema)
    .describe("Array of field definitions for the data"),
  transformCode: z
    .string()
    .describe("JavaScript code that transforms raw rows into parsed objects"),
});

export type DatasetTransformResult = z.infer<typeof transformResponseSchema>;

const TRANSFORM_PROMPT = `You are a data parsing expert. Analyze this file content and generate:

1. **datasetName**: A short name for this type of data (e.g., "bankTransactions", "productCatalog")

2. **skipRows**: How many rows to skip before the actual header row (0 if row 1 is the header)

3. **delimiter**: The field separator used ("," or ";" or "\t")

4. **schema**: Array of field definitions. For each column:
   - name: camelCase identifier in ENGLISH (e.g., "description", "transactionDate", "amount")
     * CRITICAL: Always use English names, even if headers are in other languages
     * Examples: "Descrição" → name: "description", "Data da transação" → name: "transactionDate"
   - displayName: EXACT header text from the file (preserve original language/format)
     * Examples: "Descrição" → displayName: "Descrição", "Data da transação" → displayName: "Data da transação"
   - type: "text", "number", "currency", "date", or "boolean"
   - currencyField: For currency fields, add a companion field name (e.g., "amountCurrency")

5. **transformCode**: A JavaScript function body that:
   - Receives \`rows\` (array of string arrays) and \`headers\` (string array)
   - Returns array of objects matching the schema
   - MUST separate currency values: "R$ 42.172,67" → { amount: 42172.67, amountCurrency: "BRL" }
   - Handle negative values in parentheses: "(R$ 759,00)" → -759.00
   - Parse dates to ISO format when possible
   - When parsing numeric dates, always assume the year is the rightmost segment. For example, "25.04.26" is DD-MM-YY and must be parsed as "2026-04-25".
   - Handle locale number formats (1.234,56 vs 1,234.56)

## Brazilian Number Format (CRITICAL)
When parsing Brazilian currency values (R$), use this format:
- Thousands separator: dot (.)
- Decimal separator: comma (,)
- Examples:
  - "R$ 1.891,64" → 1891.64 (NOT 1.891!)
  - "-R$ 1.891,64" → -1891.64
  - "R$ 80.000,00" → 80000.00
  - "(R$ 759,00)" → -759.00

Parsing algorithm for Brazilian format:
1. Remove currency symbol (R$, $, etc.)
2. Remove spaces
3. Check for negative indicators (- or parentheses)
4. If value contains both dot AND comma:
   - Remove ALL dots (thousands separator)
   - Replace comma with dot (decimal separator)
5. Parse as float: parseFloat(cleanedValue)

Example code pattern:
const parseBrazilianCurrency = (val) => {
  if (!val) return { amount: 0, currency: 'BRL' };
  let clean = val.trim().replace(/R\\$/g, '').trim();
  const isNegative = clean.startsWith('-') || (clean.startsWith('(') && clean.endsWith(')'));
  clean = clean.replace(/[()]/g, '').replace(/-/g, '').trim();
  if (clean.includes('.') && clean.includes(',')) {
    // Brazilian format: 1.891,64 → remove dots, replace comma with dot
    clean = clean.replace(/\\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    // European format: 1,64 → replace comma with dot
    clean = clean.replace(',', '.');
  }
  const amount = parseFloat(clean) || 0;
  return { amount: isNegative ? -amount : amount, currency: 'BRL' };
};

## Currency Symbol Mapping
Use this mapping for currency detection:
- $ → USD
- € → EUR  
- £ → GBP
- ¥ → JPY
- R$ → BRL
- ₹ → INR
- ₪ → ILS

## Transform Code Template
Your transformCode should follow this pattern:
\`\`\`javascript
// rows is an array of arrays (each row split by delimiter)
// headers is the header row array
return rows.map((row, idx) => {
  const obj = {};
  // Parse each column...
  // For currency: extract symbol, normalize number, handle negative indicators
  // For dates: convert to ISO string or keep if already parsed; the rightmost numeric segment is the year
  return obj;
});
\`\`\`

## Important Rules
- **Field names MUST be in English (camelCase)**: Even if headers are in Portuguese, Spanish, Hebrew, etc., always use English field names
  - "Descrição" → name: "description" (not "descricao")
  - "Data da transação" → name: "transactionDate" (not "dataTransacao")
  - "Valor" → name: "amount" (not "valor")
- **displayName should match the exact header**: Preserve the original header text for display purposes
- Skip empty rows
- Handle missing/null values gracefully
- For multi-section files, identify where the main data table starts
- The code should be pure JavaScript (no external dependencies)
`;

export interface GenerateTransformParams {
  fileContent: string;
  fileName: string;
  orgId: string;
  documentId: string;
}

/**
 * Use AI to analyze a file and generate schema + transform code
 */
export async function generateDatasetTransform(
  params: GenerateTransformParams
): Promise<DatasetTransformResult> {
  const { fileContent, fileName, orgId, documentId } = params;

  // Uses the extraction model
  const modelResult = await getModelProviderForOrg(orgId, "EXTRACT_DOCUMENT");

  // Take first 15 lines for rapid testing
  const lines = fileContent.split("\n").slice(0, 15);
  const sampleContent = lines.join("\n");

  const prompt = `${TRANSFORM_PROMPT}

## File Name
${fileName}

## File Content (first ${lines.length} lines)
\`\`\`
${sampleContent}
\`\`\`

Analyze this file and generate the schema and transform code.`;

  try {
    const { object, usage, response } = await generateObject({
      model: modelResult.modelObj,
      providerOptions: modelResult.providerOptions,
      messages: [{ role: "user", content: prompt }],
      schema: transformResponseSchema,
      schemaName: "DatasetTransform",
      schemaDescription: "Schema and transform code for parsing a dataset file",
    });

    // Log AI usage
    await logAiUsage({
      orgId,
      modelResult,
      usage,
      responseObj: response,
      entityId: documentId,
      entityType: "DOCUMENT",
    });

    return object;
  } catch (error) {
    // Check if this is an API key error and convert to user-friendly message
    const aiKeyError = detectAndConvertApiKeyError(error);
    if (aiKeyError) {
      throw aiKeyError;
    }
    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Execute the AI-generated transform code on raw file data
 */
export function executeTransformCode(
  rawRows: string[][],
  headers: string[],
  transformCode: string
): Record<string, unknown>[] {
  // Create a sandboxed function
  const transformFn = new Function("rows", "headers", transformCode);

  try {
    const result = transformFn(rawRows, headers);
    if (!Array.isArray(result)) {
      throw new Error("Transform code must return an array");
    }
    return result;
  } catch (error) {
    console.error("Transform code execution failed:", error);
    throw new Error(
      `Transform code execution failed: ${error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
