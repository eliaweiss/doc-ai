import * as XLSX from "xlsx";

/**
 * Converts Excel/CSV spreadsheet files to plain text (CSV per sheet).
 * The xlsx library handles all Unicode natively - Hebrew, Arabic, CJK, etc.
 *
 * Each sheet is rendered as a section with the sheet name as a header,
 * followed by its CSV content.
 *
 * @param buffer - File buffer (Excel .xls/.xlsx or CSV)
 * @returns UTF-8 text buffer with text/plain content type
 */
export function spreadsheetToText(buffer: Buffer): Buffer {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

    if (!csv.trim()) continue;

    // Add sheet header if multiple sheets
    if (workbook.SheetNames.length > 1) {
      sections.push(`=== ${sheetName} ===\n${csv}`);
    } else {
      sections.push(csv);
    }
  }

  const text = sections.join("\n\n");
  return Buffer.from(text, "utf-8");
}

/** @deprecated Use spreadsheetToText instead */
export const datasetToText = spreadsheetToText;
