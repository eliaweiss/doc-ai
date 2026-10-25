import {
  Document,
  getLineItemsForCollection,
  LineItemCollectionSchema,
  FieldDefinition,
} from "@zdocs/types";
import { formatDate, formatCurrency } from "./utils";

/**
 * Escapes a string for CSV
 */
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports document data to CSV and triggers download
 */
export function exportDocumentToCSV(
  document: Document,
  documentData: any | null,
  documentType: any | null
) {
  const rows: string[][] = [];

  // --- SECTION 1: FILE INFO ---
  rows.push(["SECTION: FILE INFORMATION"]);
  rows.push(["Field", "Value"]);
  rows.push(["File Name", document.fileName || "Untitled"]);
  rows.push(["Document Type", document.docType || "Unknown"]);
  rows.push(["Extraction Status", document.extractionStatus]);
  rows.push(["Created At", formatDate(document.createdAt)]);
  rows.push(["Updated At", formatDate(document.updatedAt)]);
  rows.push(["Currency", document.currency || "Not specified"]);
  rows.push(["Description", document.description || ""]);
  rows.push([]);

  // --- SECTION 2: HEADER DATA ---
  if (documentType?.headerSchema && documentData?.headerData) {
    rows.push(["SECTION: DOCUMENT HEADERS"]);
    rows.push(["Field", "Value"]);
    for (const field of documentType.headerSchema) {
      const value = documentData.headerData[field.name];
      let formattedValue = String(value ?? "");

      if (field.type === "currency") {
        formattedValue = formatCurrency(value as number, document.currency);
      } else if (field.type === "date") {
        formattedValue = formatDate(value as string);
      }

      rows.push([field.displayName, formattedValue]);
    }
    rows.push([]);
  }

  // --- SECTION 3: LINE ITEMS ---
  if (documentData?.lineItems && documentType?.lineItemSchemas) {
    const lineItemSchemas = documentType.lineItemSchemas as Record<
      string,
      LineItemCollectionSchema
    >;
    for (const [collectionKey, collectionSchema] of Object.entries(
      lineItemSchemas
    )) {
      const items = getLineItemsForCollection(
        documentData.lineItems,
        collectionKey
      );
      if (items.length === 0) continue;

      rows.push([
        `SECTION: LINE ITEMS - ${collectionSchema.displayName || collectionKey
        }`,
      ]);

      // Header row for this collection
      const headers = collectionSchema.fields.map(
        (f: FieldDefinition) => f.displayName
      );
      rows.push(headers);

      // Data rows
      for (const item of items) {
        const row = collectionSchema.fields.map((field: FieldDefinition) => {
          const value = item[field.name];
          if (field.type === "currency") {
            return formatCurrency(value as number, document.currency);
          } else if (field.type === "date") {
            return formatDate(value as string);
          }
          return String(value ?? "");
        });
        rows.push(row);
      }
      rows.push([]);
    }
  }

  // Convert to CSV string
  const csvContent = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");

  // Trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${document.fileName || "document"}_${timestamp}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
}
