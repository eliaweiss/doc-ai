/**
 * Dataset loading queries for formula execution.
 *
 * Datasets are documents with isDataset: true. Their line items are loaded
 * and provided to code fields for enrichment and validation.
 *
 * @module dataset-queries
 */

import { zdocsDb } from "../db";
import { documentTbl, documentDataTbl } from "../schemas/documents";
import { documentTypesTbl } from "../schemas/document-types";
import { eq, and, isNull, desc, or, sql } from "drizzle-orm";

// Check if we're running in Edge Runtime
const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

/**
 * Load datasets by type name for formula execution.
 *
 * For each dataset type name, loads the latest dataset document's line items.
 * Returns a map keyed by dataset type name.
 *
 * @param orgId - The organization ID
 * @param datasetTypeNames - Array of dataset type names to load
 * @returns Map of dataset type name to array of records (line items)
 *
 * @example
 * const datasets = await loadDatasetsForFormulas(orgId, ["code2erpId", "productCatalog"]);
 * // Returns:
 * // {
 * //   "code2erpId": [{ "code from receipt": "ABC", "erp internal id": "ERP001" }, ...],
 * //   "productCatalog": [{ "sku": "SKU001", "name": "Widget", "price": 9.99 }, ...]
 * // }
 */
export async function loadDatasetsForFormulas(
  orgId: string,
  datasetTypeNames: string[],
  options: {
    includeDisplayName?: boolean;
  } = {
    includeDisplayName: true,
  }
): Promise<Record<string, Record<string, unknown>[]>> {
  if (isEdgeRuntime || datasetTypeNames.length === 0) {
    return {};
  }

  const result: Record<string, Record<string, unknown>[]> = {};

  // Load each dataset type
  for (const typeName of datasetTypeNames) {
    try {
      // Find the latest dataset document of this type
      // Join with document_types to match by name (case-insensitive)
      const latestDataset = await zdocsDb
        .select({
          documentId: documentTbl.id,
          docType: documentTbl.docType,
          docTypeDisplayName: documentTypesTbl.displayName,
          lineItemSchemas: documentTypesTbl.lineItemSchemas,
        })
        .from(documentTbl)
        .innerJoin(
          documentTypesTbl,
          and(
            eq(documentTbl.docType, documentTypesTbl.name),
            eq(documentTbl.orgId, documentTypesTbl.orgId)
          )
        )
        .where(
          and(
            eq(documentTbl.orgId, orgId),
            eq(documentTbl.isDataset, true),
            eq(documentTypesTbl.isDataset, true),
            isNull(documentTbl.deletedAt),
            isNull(documentTypesTbl.deletedAt),
            // Case-insensitive match on document type name
            sql`LOWER(${documentTypesTbl.name}) = LOWER(${typeName})`
          )
        )
        .orderBy(desc(documentTbl.updatedAt))
        .limit(1)
        .execute();

      if (latestDataset.length === 0) {
        console.warn(
          `[loadDatasetsForFormulas] Dataset type "${typeName}" not found for org ${orgId}`
        );
        result[typeName] = [];
        continue;
      }

      const documentId = latestDataset[0].documentId;
      const actualDocType = latestDataset[0].docType;
      const docTypeDisplayName = latestDataset[0].docTypeDisplayName;
      const lineItemSchemas = latestDataset[0].lineItemSchemas as Record<
        string,
        { fields: Array<{ name: string; displayName?: string }> }
      > | null;

      // Load the document data (line items)
      const documentData = await zdocsDb
        .select({
          lineItems: documentDataTbl.lineItems,
        })
        .from(documentDataTbl)
        .where(
          and(
            eq(documentDataTbl.documentId, documentId),
            eq(documentDataTbl.orgId, orgId),
            isNull(documentDataTbl.deletedAt)
          )
        )
        .limit(1)
        .execute();

      if (documentData.length === 0 || !documentData[0].lineItems) {
        result[typeName] = [];
        continue;
      }

      // Datasets typically have a single collection called "records" or similar
      // Flatten all collections into a single array
      const lineItems = documentData[0].lineItems as Record<
        string,
        Record<string, unknown>[]
      >;

      // Build a map of fieldName -> displayName from all collections' schemas
      const fieldNameToDisplayName: Record<string, string> = {};
      if (lineItemSchemas) {
        for (const collectionSchema of Object.values(lineItemSchemas)) {
          for (const field of collectionSchema.fields || []) {
            if (field.displayName && field.name !== field.displayName) {
              fieldNameToDisplayName[field.name] = field.displayName;
            }
          }
        }
      }

      // Merge all collections into a single array and add displayName aliases
      const allRecords: Record<string, unknown>[] = [];
      for (const collection of Object.values(lineItems)) {
        if (Array.isArray(collection)) {
          for (const record of collection) {
            const enrichedRecord = { ...record };
            if (options?.includeDisplayName) {
              // Add displayName aliases for each field
              for (const [fieldName, displayName] of Object.entries(
                fieldNameToDisplayName
              )) {
                if (fieldName in record && !(displayName in record)) {
                  enrichedRecord[displayName] = record[fieldName];
                }
              }
            }
            allRecords.push(enrichedRecord);
          }
        }
      }

      // Store by requested typeName, actual docType, and displayName
      result[typeName] = allRecords;
      if (options?.includeDisplayName) {
        if (actualDocType) result[actualDocType] = allRecords;
        if (docTypeDisplayName) result[docTypeDisplayName] = allRecords;
      }
    } catch (error) {
      console.error(
        `[loadDatasetsForFormulas] Error loading dataset "${typeName}":`,
        error
      );
      result[typeName] = [];
    }
  }

  return result;
}

/**
 * List all dataset documents for an organization.
 * Useful for debugging which datasets are available.
 *
 * @param orgId - The organization ID
 * @returns Array of dataset documents with their docType and fileName
 */
export async function listDatasetDocumentsForOrg(
  orgId: string
): Promise<Array<{ id: string; docType: string; fileName: string | null }>> {
  if (isEdgeRuntime) return [];

  const result = await zdocsDb
    .select({
      id: documentTbl.id,
      docType: documentTbl.docType,
      fileName: documentTbl.fileName,
    })
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        eq(documentTbl.isDataset, true),
        isNull(documentTbl.deletedAt)
      )
    )
    .execute();

  return result.map((r) => ({
    id: r.id,
    docType: r.docType || "(no docType)",
    fileName: r.fileName,
  }));
}

/**
 * Collect all dataset type names from formula fields.
 *
 * Scans header schema and line item schemas for code/ai fields that
 * reference datasets, and returns a deduplicated list of dataset type names.
 *
 * @param headerSchema - The header schema fields
 * @param lineItemSchemas - The line item schemas (optional)
 * @returns Array of unique dataset type names
 */
export function collectDatasetTypeNames(
  headerSchema: Array<{ formula?: { datasets?: string[] } }>,
  lineItemSchemas?: Record<
    string,
    { fields: Array<{ formula?: { datasets?: string[] } }> }
  > | null
): string[] {
  const datasetNames = new Set<string>();

  // Collect from header schema
  for (const field of headerSchema) {
    if (field.formula?.datasets) {
      for (const name of field.formula.datasets) {
        datasetNames.add(name);
      }
    }
  }

  // Collect from line item schemas
  if (lineItemSchemas) {
    for (const collection of Object.values(lineItemSchemas)) {
      for (const field of collection.fields) {
        if (field.formula?.datasets) {
          for (const name of field.formula.datasets) {
            datasetNames.add(name);
          }
        }
      }
    }
  }

  return Array.from(datasetNames);
}
