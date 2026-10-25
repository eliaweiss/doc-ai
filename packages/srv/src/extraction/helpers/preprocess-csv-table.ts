import { generateObject } from "ai";
import { z } from "zod";
import type { ModelProviderResult } from "../../ai/ai-key-provider";
import { logAiUsage } from "../../ai/ai-usage-service";
import { getJsonFromCache, saveJsonToCache } from "../s3-cache";
import { splitCsvRecords } from "./split-csv-records";

export interface PreprocessCsvTableResult {
  /** The CSV column header values, in order */
  tableHeaders: string[];
  /** 1-indexed line number of the header row (matches the `#N,` prefix) */
  tableStartLine: number;
  /** 1-indexed line number of the last data row of the table */
  tableEndLine: number;
}

const csvTableEntrySchema = z.object({
  tableHeaders: z
    .array(z.string())
    .describe(
      "The CSV column header values in order, exactly as they appear in the header row"
    ),
  tableStartLine: z
    .number()
    .int()
    .describe(
      "The 1-indexed line number of the table header row. Use the #N number at the start of the line."
    ),
  tableEndLine: z
    .number()
    .int()
    .describe(
      "The 1-indexed line number of the last data row of the table. Use the #N number at the start of the line."
    ),
});

const preprocessCsvTablesSchema = z.object({
  tables: z
    .array(csvTableEntrySchema)
    .describe(
      "All data tables found in the document, in order of appearance"
    ),
});

/**
 * Strip any leftover `#N,` / `#N` line-number prefix from header values.
 *
 * Because we feed the document with `#N,` prefixed to each line, the model
 * sometimes echoes that prefix back as part of the first header value
 * (e.g. `"#5,Date"` instead of `"Date"`, or even just `"#5"` as a stray
 * extra header). This normalizes them and drops headers that contain only
 * a `#N` token.
 */
function sanitizeTableHeaders(headers: string[]): string[] {
  const cleaned: string[] = [];
  for (const raw of headers) {
    if (typeof raw !== "string") continue;
    let value = raw.trim();

    // Drop a leading `#N,` or `#N ` or `#N\t` (with optional whitespace).
    value = value.replace(/^#\d+\s*[,\t ]\s*/, "");

    // If the entire value is just `#N` (no content after), skip it entirely.
    if (/^#\d+$/.test(value.trim())) continue;

    cleaned.push(value);
  }
  return cleaned;
}

/**
 * Normalize a cached preprocess result: old single-table format (object with
 * `tableHeaders`) is wrapped in an array; new multi-table format (array) is
 * returned as-is.
 */
function normalizeCachedResult(
  cached: unknown
): PreprocessCsvTableResult[] | null {
  if (!cached || typeof cached !== "object") return null;

  if (Array.isArray(cached)) return cached as PreprocessCsvTableResult[];

  const obj = cached as Record<string, unknown>;
  if ("tableHeaders" in obj && "tableStartLine" in obj && "tableEndLine" in obj) {
    return [obj as unknown as PreprocessCsvTableResult];
  }

  return null;
}

/**
 * Detect table boundaries in a CSV using a single AI call.
 *
 * The model is unreliable at counting, so each line is prefixed with `#N,`
 * (1-indexed) before being sent. The model is then asked to report the
 * start/end line numbers by reading the `#N` prefix.
 *
 * Returns an array of table descriptors - one per logical table found in the
 * CSV. Documents with a single table produce a one-element array.
 *
 * Result is cached at `{cachePrefix}/csv-preprocess.json`.
 */
export async function preprocessCsvTable(params: {
  textContent: string;
  modelResult: ModelProviderResult;
  documentId: string;
  orgId: string;
  cachePrefix: string;
}): Promise<PreprocessCsvTableResult[]> {
  const { textContent, modelResult, documentId, orgId, cachePrefix } = params;

  const cacheKey = `${cachePrefix}/csv-preprocess.json`;
  const cached = await getJsonFromCache<unknown>(cacheKey);
  if (cached) {
    const normalized = normalizeCachedResult(cached);
    if (normalized) {
      console.log(
        `[CSV preprocess] Cache **HIT** for document ${documentId}: ${normalized.length} table(s)`
      );
      return normalized;
    }
  }
  console.log(`[CSV preprocess] Cache **MISS** for document ${documentId}`);

  const records = splitCsvRecords(textContent);
  const numberedText = records
    .map((record, index) => `#${index + 1},${record}`)
    .join("\n");

  const prompt = `You are analyzing a CSV/text document to locate ALL data tables.

Each record below is prefixed with \`#N,\` where N is the 1-indexed record number. Use these numbers to identify the table boundaries.

A record is one logical CSV row. Quoted fields may contain newlines, so a single #N record can span more than one visual line. Always use the #N on the first line of the record.

For each table found, return:
- "tableHeaders": the column header values from the table header row, in order
- "tableStartLine": the record number (the N from #N) of the table header row
- "tableEndLine": the record number (the N from #N) of the last data row of the table

Notes:
- A header row contains column names (not data values).
- Skip any preamble records (titles, blank records, metadata) before each header row.
- Stop each table at its last meaningful data row; ignore trailing summary/footer/blank records (e.g. totals rows) that are not part of the table body.
- If the document contains multiple tables (possibly separated by section titles, blank records, or summary rows), return ALL of them as separate entries in the "tables" array, in order of appearance.
- Tables may have similar or identical column structures but represent different data sections.

Document:
${numberedText}
`;

  const startTime = Date.now();
  const { object, usage, response } = await generateObject({
    model: modelResult.modelObj,
    providerOptions: modelResult.providerOptions,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
    schema: preprocessCsvTablesSchema,
    schemaName: "CsvTablesPreprocess",
    schemaDescription: "Detected CSV table boundaries and headers for all tables in the document",
  });
  const duration = Date.now() - startTime;

  const results: PreprocessCsvTableResult[] = object.tables.map(
    (table, idx) => {
      const sanitizedHeaders = sanitizeTableHeaders(table.tableHeaders);

      if (
        sanitizedHeaders.length !== table.tableHeaders.length ||
        sanitizedHeaders.some((h, i) => h !== table.tableHeaders[i])
      ) {
        console.log(
          `[CSV preprocess] document ${documentId}, table ${idx + 1}: stripped #N prefix from headers. raw=${JSON.stringify(table.tableHeaders)}, sanitized=${JSON.stringify(sanitizedHeaders)}`
        );
      }

      console.log(
        `[CSV preprocess] document ${documentId}, table ${idx + 1}/${object.tables.length}: tableStartLine=${table.tableStartLine}, tableEndLine=${table.tableEndLine}, headers=${JSON.stringify(sanitizedHeaders)}`
      );

      return {
        tableHeaders: sanitizedHeaders,
        tableStartLine: table.tableStartLine,
        tableEndLine: table.tableEndLine,
      };
    }
  );

  console.log(
    `[CSV preprocess] document ${documentId}: found ${results.length} table(s), duration=${duration}ms`
  );

  await saveJsonToCache(cacheKey, results);

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
        step: "csv-preprocess",
        usage,
      },
    });
  } catch (usageError) {
    console.error(
      `Failed to log AI usage for CSV preprocess (document ${documentId}), continuing`,
      usageError
    );
  }

  return results;
}
