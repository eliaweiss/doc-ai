import type { ColDef } from "ag-grid-community";
import type { FieldDefinition } from "@zdocs/types";
import { formatDate, formatCurrency } from "./utils";

/**
 * Escapes markdown special characters
 */
function escapeMarkdown(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  // Escape pipe characters which are used for table separators
  return str.replace(/\|/g, "\\|");
}

/**
 * Gets the formatted value for a cell based on field type
 */
function getFormattedValue(
  value: unknown,
  field: FieldDefinition | undefined,
  rowData: any
): string {
  if (value === null || value === undefined) return "-";

  if (!field) {
    return escapeMarkdown(value);
  }

  switch (field.type) {
    case "currency":
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(numValue as number)) return "-";
      const currencyCode =
        (rowData?.data?.[field.currencyField || "currency"] as string) ||
        (rowData?.metadata?.currency as string) ||
        "USD";
      return formatCurrency(numValue as number, currencyCode);

    case "number":
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(num as number)) return "-";
      return (num as number).toLocaleString();

    case "date":
      return formatDate(value as string | Date);

    case "boolean":
      return value ? "Yes" : "No";

    case "enum":
      return String(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());

    default:
      return escapeMarkdown(value);
  }
}

/**
 * Exports grid data to Markdown table format and triggers download
 */
export function exportGridToMarkdown(
  columnDefs: ColDef[],
  rowData: any[],
  schema: FieldDefinition[],
  fileName?: string
) {
  // Filter out sum rows and get visible columns
  const visibleColumns = columnDefs.filter(
    (col) => !col.hide && col.colId !== "checkbox"
  );
  const dataRows = rowData.filter((row) => !row.isSumRow);

  if (dataRows.length === 0) {
    throw new Error("No data to export");
  }

  const lines: string[] = [];

  // Header row
  const headers = visibleColumns.map(
    (col) => col.headerName || col.colId || ""
  );
  lines.push(`| ${headers.map(escapeMarkdown).join(" | ")} |`);

  // Separator row
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  // Data rows
  for (const row of dataRows) {
    const rowValues: string[] = [];
    for (const col of visibleColumns) {
      const colId = col.colId || col.field || "";
      let value: unknown = null;

      // Get value using valueGetter if available, otherwise use field path
      if (col.valueGetter && typeof col.valueGetter === "function") {
        // Create a mock params object for valueGetter
        const params = {
          data: row,
          value: null,
        };
        value = col.valueGetter(params as any);
      } else if (col.field) {
        // Navigate the field path (e.g., "data.amount" or "metadata.date")
        const parts = col.field.split(".");
        value = parts.reduce((obj: any, part) => obj?.[part], row);
      }

      // Find the field definition for formatting
      const fieldName = colId.replace(/^(data|metadata)\./, "");
      const field =
        fieldName === "date" && colId.startsWith("metadata.")
          ? { name: "date", type: "date" as const, displayName: "Date" }
          : schema.find((f) => f.name === fieldName);

      const formattedValue = getFormattedValue(value, field, row);
      rowValues.push(formattedValue);
    }
    lines.push(`| ${rowValues.join(" | ")} |`);
  }

  // Convert to markdown string
  const markdownContent = lines.join("\n");

  // Trigger download
  const blob = new Blob([markdownContent], {
    type: "text/markdown;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalFileName = fileName || `export_${timestamp}.md`;

  link.setAttribute("href", url);
  link.setAttribute("download", finalFileName);
  link.style.visibility = "hidden";
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
