import path from "path";

const BINARY_SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".xlsm"];
const BINARY_SPREADSHEET_MIME_TYPES = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
];

const TEXT_SPREADSHEET_EXTENSIONS = [".csv"];
const TEXT_SPREADSHEET_MIME_TYPES = ["text/csv"];

/**
 * Detect if a file is a spreadsheet (Excel/CSV) based on its name or mime type.
 * Includes both binary (XLS/XLSX) and text (CSV) spreadsheets.
 */
export function isSpreadsheetFile(fileName: string, mimeType?: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    const allExtensions = [...BINARY_SPREADSHEET_EXTENSIONS, ...TEXT_SPREADSHEET_EXTENSIONS];
    const allMimeTypes = [...BINARY_SPREADSHEET_MIME_TYPES, ...TEXT_SPREADSHEET_MIME_TYPES];
    return (
        allExtensions.includes(ext) ||
        (mimeType && allMimeTypes.includes(mimeType)) ||
        false
    );
}

/**
 * Detect if a file is a binary spreadsheet (XLS/XLSX/XLSM) that needs
 * conversion to plain text via the xlsx library.
 * CSV files are already plain text and should NOT go through spreadsheetToText
 * because the xlsx library incorrectly parses date strings.
 */
export function isBinarySpreadsheetFile(fileName: string, mimeType?: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return (
        BINARY_SPREADSHEET_EXTENSIONS.includes(ext) ||
        (mimeType && BINARY_SPREADSHEET_MIME_TYPES.includes(mimeType)) ||
        false
    );
}
