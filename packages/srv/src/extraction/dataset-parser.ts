import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  type FieldDefinition,
  type FieldType,
  type ParsedDataset,
  DATASET_LIMITS,
} from "@zdocs/types";
import {
  generateDatasetTransform,
  executeTransformCode,
} from "./dataset-transform-generator";
import { isSpreadsheetFile } from "./isSpreadsheetFile";

/**
 * Date order format: DMY (day/month/year), MDY (month/day/year), YMD (year/month/day)
 */
export type DateOrder = "DMY" | "MDY" | "YMD";

/**
 * Options for parsing Excel/CSV files
 */
export interface ParseOptions {
  /** Date order from the client's locale (e.g., "DMY" for Brazil, "MDY" for US) */
  dateOrder?: DateOrder;
}

// Module-level variable to store the current date order for parsing
let currentDateOrder: DateOrder = "DMY";

// /**
//  * Set the date order for parsing (called before parsing operations)
//  */
// function setDateOrder(order: DateOrder | undefined): void {
//   currentDateOrder = order || getDefaultDateOrder();
// }

/**
 * Get the default date order from server locale (fallback)
 */
function getDefaultDateOrder(): DateOrder {
  const formatter = new Intl.DateTimeFormat();
  const parts = formatter.formatToParts(new Date(2000, 11, 25));
  const order = parts
    .filter((p) => ["day", "month", "year"].includes(p.type))
    .map((p) => p.type[0].toUpperCase())
    .join("");
  if (order === "DMY" || order === "MDY" || order === "YMD") {
    return order;
  }
  return "DMY";
}



/**
 * Use AI to analyze a file and generate schema + transform code to parse it.
 * This is more robust than standard parsing for complex or non-standard files.
 * Supports both CSV and Excel (.xlsx/.xls) files.
 */
export async function parseWithAiTransform(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  orgId: string,
  documentId: string
): Promise<ParsedDataset> {
  // Detect Excel files by MIME type (most reliable)
  const isExcelByContentType =
    contentType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || // .xlsx
    contentType === "application/vnd.ms-excel"; // .xls

  console.log(`[Dataset AI] File detection:`, {
    fileName,
    contentType,
    isExcelByContentType,
  });

  const isExcel = isExcelByContentType;

  // Convert file to text (Excel -> CSV, or read CSV directly)
  let content: string;
  if (isExcel) {
    // Parse Excel and convert to CSV text for AI and parsing
    try {
      console.log(
        `[Dataset AI] Parsing Excel file, buffer length: ${buffer.length}`
      );

      const workbook = XLSX.read(buffer, { type: "buffer" });

      console.log(`[Dataset AI] Workbook parsed:`, {
        sheetNames: workbook.SheetNames,
        sheetCount: workbook.SheetNames?.length,
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file has no sheets");
      }
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }

      // Check if sheet has data
      const sheetRef = sheet["!ref"];
      if (sheetRef) {
        const range = XLSX.utils.decode_range(sheetRef);
        console.log(`[Dataset AI] Sheet range:`, sheetRef, "decoded:", range);
      } else {
        console.warn(`[Dataset AI] Sheet has no !ref - may be empty`);
      }

      content = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

      // Verify the content looks like CSV, not binary
      if (content.startsWith("PK") || content.includes("\x00")) {
        console.error(
          `[Dataset AI] CSV conversion failed - content appears to be binary`
        );
        throw new Error(
          "Excel parsing failed - output is binary, not CSV. The file may be corrupted or not a valid Excel file."
        );
      }

      if (!content || content.length === 0) {
        throw new Error("Excel sheet is empty");
      }
    } catch (error) {
      console.error("[Dataset AI] Excel parsing error:", error);
      throw new Error(
        `Failed to parse Excel file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } else {
    // CSV - read as UTF-8
    content = buffer.toString("utf-8");
  }

  console.log(
    `[Dataset AI] Content preview (first 500 chars):`,
    content.slice(0, 500)
  );
  console.log(`[Dataset AI] Content type:`, typeof content);
  console.log(`[Dataset AI] Content length:`, content.length);
  console.log(`[Dataset AI] First 5 lines:`, content.split("\n").slice(0, 5));

  // Generate transform using AI
  const transform = await generateDatasetTransform({
    fileContent: content,
    fileName,
    orgId,
    documentId,
  });

  console.log(`[Dataset AI] Transform result:`, {
    datasetName: transform.datasetName,
    skipRows: transform.skipRows,
    delimiter: JSON.stringify(transform.delimiter),
    schemaFields: transform.schema.map((f) => f.name),
    transformCodeLength: transform.transformCode.length,
    transformCodePreview: transform.transformCode.slice(0, 200),
  });

  // Normalize delimiter (ensure it's one of the valid delimiters)
  let delimiter: "," | ";" | "\t" = transform.delimiter;
  // Handle case where AI might return quoted delimiter
  if (delimiter.includes('"')) {
    const cleaned = delimiter.replace(/"/g, "");
    if (cleaned === "," || cleaned === ";" || cleaned === "\t") {
      delimiter = cleaned as "," | ";" | "\t";
    }
  }
  // Ensure delimiter is valid
  if (![",", ";", "\t"].includes(delimiter)) {
    console.warn(
      `[Dataset AI] Invalid delimiter "${delimiter}", defaulting to comma`
    );
    delimiter = ",";
  }

  console.log(`[Dataset AI] Using delimiter:`, JSON.stringify(delimiter));

  // Parse CSV properly using papaparse (handles quoted values, commas inside quotes, etc.)
  const parseResult = Papa.parse(content, {
    delimiter: delimiter,
    skipEmptyLines: true,
    header: false, // We'll handle headers manually based on skipRows
  });

  if (parseResult.errors.length > 0) {
    console.warn(
      `[Dataset AI] CSV parse warnings:`,
      parseResult.errors.slice(0, 3)
    );
  }

  const allRows = parseResult.data as string[][];
  const dataLines = allRows.slice(transform.skipRows);

  if (dataLines.length < 2) {
    throw new Error("Not enough data rows after skipping");
  }

  const headers = dataLines[0].map((cell) => cell.trim());
  const dataRows = dataLines
    .slice(1)
    .map((row) =>
      row.map((cell) => (typeof cell === "string" ? cell.trim() : cell))
    );

  console.log(`[Dataset AI] Parsed data:`, {
    headerCount: headers.length,
    headers: headers.slice(0, 5),
    dataRowCount: dataRows.length,
    firstRowPreview: dataRows[0]?.slice(0, 5),
  });

  // Execute transform code to get structured objects
  let transformedRows: Record<string, unknown>[];
  try {
    transformedRows = executeTransformCode(
      dataRows,
      headers,
      transform.transformCode
    );
  } catch (error) {
    console.error("[Dataset AI] Transform execution failed:", error);
    throw new Error(
      `Transform code execution failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // Validate transform results
  if (!Array.isArray(transformedRows)) {
    throw new Error(
      `Transform code must return an array, got ${typeof transformedRows}`
    );
  }

  if (transformedRows.length === 0) {
    throw new Error(
      "Transform code returned empty array - no data rows were processed"
    );
  }

  // Verify that rows have expected schema fields
  const expectedFields = transform.schema.map((f) => f.name);
  const firstRowKeys = Object.keys(transformedRows[0] || {});
  const missingFields = expectedFields.filter(
    (field) => !firstRowKeys.includes(field)
  );

  if (missingFields.length > 0) {
    console.warn(
      `[Dataset AI] Transform output missing expected fields:`,
      missingFields
    );
  }

  // Verify that at least some rows have non-empty data
  const rowsWithData = transformedRows.filter((row) => {
    return Object.values(row).some(
      (value) => value !== null && value !== undefined && value !== ""
    );
  });

  if (rowsWithData.length === 0) {
    throw new Error(
      "Transform code produced rows but all fields are empty - transform may not be mapping data correctly"
    );
  }

  if (rowsWithData.length < transformedRows.length * 0.5) {
    console.warn(
      `[Dataset AI] Only ${rowsWithData.length} of ${transformedRows.length} rows have data`
    );
  }

  console.log(`[Dataset AI] Transform output:`, {
    rowCount: transformedRows.length,
    rowsWithData: rowsWithData.length,
    firstRowKeys: Object.keys(transformedRows[0] || {}),
    expectedFields,
    missingFields,
    firstRowPreview: transformedRows[0],
  });

  // Find the first text field index for description
  const firstTextFieldIndex = transform.schema.findIndex(
    (f) => f.type === "text"
  );

  // Build schema from AI response
  const schema: FieldDefinition[] = transform.schema.map((field, index) => ({
    name: field.name,
    displayName: field.displayName,
    type: field.type as FieldType,
    currencyField: field.currencyField,
    required: false,
    searchable: field.type === "text",
    isImportant: true,
    isReconcilable: true,
    isPrimaryKey: index === 0,
    isDescription: index === firstTextFieldIndex,
  }));

  // Ensure companion currency fields are in the schema
  for (const field of transform.schema) {
    if (
      field.currencyField &&
      !schema.find((f) => f.name === field.currencyField)
    ) {
      schema.push({
        name: field.currencyField,
        displayName: `${field.displayName} Currency`,
        type: "text",
        required: false,
        searchable: true,
        isImportant: true,
        isReconcilable: false,
        isPrimaryKey: false,
        isDescription: false,
      });
    }
  }

  const parsed: ParsedDataset = {
    headers: schema.map((f) => f.displayName),
    schema,
    rows: transformedRows,
    rowCount: transformedRows.length,
    transform: {
      datasetName: transform.datasetName,
      skipRows: transform.skipRows,
      delimiter,
      transformCode: transform.transformCode,
    },
  };

  validateParsedDataset(parsed);

  return parsed;
}

const CURRENCY_MAP: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  R$: "BRL",
  "₹": "INR",
  "₪": "ILS",
};

/**
 * Check if a string looks like a strict currency value.
 * Must be ONLY: [negative indicator][currency symbol/code][number] or similar.
 * No extra text allowed.
 */
function isStrictCurrencyFormat(s: string): boolean {
  // Remove whitespace for analysis
  const cleaned = s.replace(/\s+/g, " ").trim();

  // Must contain at least one digit
  if (!/\d/.test(cleaned)) return false;

  // Build regex for currency symbols
  const symbolsEscaped = Object.keys(CURRENCY_MAP)
    .map((sym) => sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  // Strict patterns:
  // 1. [-]?[symbol][space]?[number] e.g., "-R$ 1.234,56" or "$100"
  // 2. [number][space]?[symbol][-]? e.g., "1.234,56 €" or "100$"
  // 3. [(][symbol][number][)] e.g., "(R$ 1.234,56)"
  // Number pattern: digits with optional thousand separators (,.') and decimal
  const numPattern = `[\\d][\\d.,'\u00A0 ]*[\\d]|[\\d]`;

  const pattern1 = new RegExp(
    `^-?\\s*(${symbolsEscaped})\\s*(${numPattern})$`,
    "i"
  );
  const pattern2 = new RegExp(
    `^(${numPattern})\\s*(${symbolsEscaped})\\s*-?$`,
    "i"
  );
  const pattern3 = new RegExp(
    `^\\(\\s*(${symbolsEscaped})\\s*(${numPattern})\\s*\\)$`,
    "i"
  );

  return (
    pattern1.test(cleaned) || pattern2.test(cleaned) || pattern3.test(cleaned)
  );
}

function parseCurrencyValue(val: unknown): {
  value: number | null;
  currency: string | null;
} {
  if (val == null || val === "") return { value: null, currency: null };
  if (typeof val === "number") return { value: val, currency: null };

  let s = String(val).trim();

  // 1. Handle negative indicators: leading minus, or parentheses like (R$ 1.234,56)
  let isNegative = false;
  let cleaned = s;
  if (cleaned.startsWith("-")) {
    isNegative = true;
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1).trim();
  }

  // 2. Extract currency symbol (sorted by length desc to match R$ before $)
  let currency: string | null = null;

  const sortedSymbols = Object.entries(CURRENCY_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [symbol, code] of sortedSymbols) {
    if (cleaned.startsWith(symbol)) {
      currency = code;
      cleaned = cleaned.slice(symbol.length).trim();
      break;
    } else if (cleaned.endsWith(symbol)) {
      currency = code;
      cleaned = cleaned.slice(0, cleaned.length - symbol.length).trim();
      break;
    }
  }

  // 3. Handle trailing minus (some formats put minus at end)
  if (!isNegative && cleaned.endsWith("-")) {
    isNegative = true;
    cleaned = cleaned.slice(0, -1).trim();
  }

  // 4. Normalize number format
  let value: number | null = null;

  // Keep only digits, comma, period, minus
  const numPart = cleaned.replace(/[^0-9.,-]/g, "");

  if (numPart) {
    const lastComma = numPart.lastIndexOf(",");
    const lastPeriod = numPart.lastIndexOf(".");

    let normalized = numPart;
    if (lastComma > lastPeriod) {
      // EU/BR format: 1.234,56 -> 1234.56
      normalized = numPart.replace(/\./g, "").replace(/,/g, ".");
    } else if (lastPeriod > lastComma) {
      // US format: 1,234.56 -> 1234.56
      normalized = numPart.replace(/,/g, "");
    } else {
      // Only one type of separator or none
      normalized = numPart.replace(/,/g, ".");
    }

    // Remove any remaining minus signs (we already captured negativity)
    normalized = normalized.replace(/-/g, "");

    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      value = isNegative ? -Math.abs(parsed) : parsed;
    }
  }

  // If we couldn't find a number, return nulls
  if (value === null) return { value: null, currency: null };

  // If it's a number but doesn't look like currency (no symbol and not strict),
  // we still return the value but currency is null.
  // The caller (inferFieldType) will handle whether this counts as a currency field.
  return { value, currency };
}

/**
 * Infer the type of a field based on sample values
 */
function inferFieldType(
  columnName: string,
  sampleValues: unknown[]
): FieldType {
  const nonNull = sampleValues.filter((v) => v != null && v !== "");

  if (nonNull.length === 0) return "text";

  // Check for currency patterns first (more specific than number)
  if (
    nonNull.some((v) => {
      if (typeof v === "string") {
        const { value, currency } = parseCurrencyValue(v);
        return value !== null && currency !== null;
      }
      return false;
    })
  ) {
    return "currency";
  }

  // Check if all values are numbers
  if (
    nonNull.every(
      (v) =>
        typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== "")
    )
  ) {
    return "number";
  }

  // Check if all values are dates
  if (nonNull.every((v) => v instanceof Date || isValidDateString(String(v)))) {
    return "date";
  }

  // Check if all values are booleans
  if (
    nonNull.every(
      (v) =>
        typeof v === "boolean" ||
        ["true", "false", "yes", "no", "1", "0"].includes(
          String(v).toLowerCase()
        )
    )
  ) {
    return "boolean";
  }

  return "text";
}

/**
 * Try to parse a date string based on locale format (DD/MM/YYYY, MM/DD/YYYY, or YYYY/MM/DD)
 * Uses the currentDateOrder set by setDateOrder()
 */
function parseLocaleDateString(s: string): Date | null {
  const match = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (!match) return null;

  let day: number, month: number, year: number;

  switch (currentDateOrder) {
    case "DMY":
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1;
      year = parseInt(match[3], 10);
      break;
    case "MDY":
      month = parseInt(match[1], 10) - 1;
      day = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
      break;
    case "YMD":
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1;
      day = parseInt(match[3], 10);
      break;
  }

  const d = new Date(year, month, day);
  // Validate the date is real (e.g., Feb 30 would roll over)
  if (
    d.getDate() !== day ||
    d.getMonth() !== month ||
    d.getFullYear() !== year
  ) {
    return null;
  }
  return d;
}

/**
 * Check if a string is a valid date
 */
function isValidDateString(s: string): boolean {
  // First try locale-aware format parsing
  const localeParsed = parseLocaleDateString(s);
  if (localeParsed) {
    return true;
  }

  // Fallback to standard JS Date parsing (handles ISO format, etc.)
  const d = new Date(s);
  return !isNaN(d.getTime()) && s.length >= 8; // Simple heuristic to avoid short numbers being parsed as dates
}

/**
 * Normalize a header string into a camelCase field name
 */
export function normalizeFieldName(header: string): string {
  return header
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}

/**
 * Build a document schema from headers and rows
 */
export function buildSchemaFromHeaders(
  headers: string[],
  rows: Record<string, unknown>[]
): FieldDefinition[] {
  const firstTextFieldIndex = headers.findIndex((h) => {
    const samples = rows.slice(0, 20).map((r) => r[normalizeFieldName(h)]);
    return inferFieldType(h, samples) === "text";
  });

  const schema: FieldDefinition[] = [];

  headers.forEach((header, index) => {
    const fieldName = normalizeFieldName(header);
    const sampleValues = rows.slice(0, 20).map((row) => row[fieldName]);
    const fieldType = inferFieldType(header, sampleValues);
    const isFirstField = index === 0;
    const isFirstTextField = index === firstTextFieldIndex;

    const currencyFieldName = `${fieldName}Currency`;
    const isCurrency = fieldType === "currency";

    schema.push({
      name: fieldName,
      displayName: header,
      type: isCurrency ? "currency" : fieldType,
      currencyField: isCurrency ? currencyFieldName : undefined,
      required: false,

      // Dataset field defaults
      searchable: fieldType === "text",
      isImportant: true,
      isReconcilable: true,

      // First field is treated as the key/identifier
      isPrimaryKey: isFirstField,

      // First text field becomes the description for search results
      isDescription: isFirstTextField,
    });

    // Auto-add companion currency field for currency columns
    // ONLY if it doesn't already exist in the headers (to avoid duplicates)
    if (
      isCurrency &&
      !headers.some((h) => normalizeFieldName(h) === currencyFieldName)
    ) {
      schema.push({
        name: currencyFieldName,
        displayName: `${header} Currency`,
        type: "text",
        required: false,
        searchable: true,
        isImportant: true,
        isReconcilable: false,
        isPrimaryKey: false,
        isDescription: false,
      });
    }
  });

  return schema;
}

/**
 * Validate that the parsed dataset doesn't exceed limits
 */
function validateParsedDataset(parsed: ParsedDataset): void {
  if (parsed.rows.length === 0) {
    throw new Error("File has no data rows");
  }
  if (parsed.rows.length > DATASET_LIMITS.maxRows) {
    throw new Error(`Dataset exceeds ${DATASET_LIMITS.maxRows} row limit`);
  }
  if (parsed.headers.length > DATASET_LIMITS.maxColumns) {
    throw new Error(
      `Dataset exceeds ${DATASET_LIMITS.maxColumns} column limit`
    );
  }
}
