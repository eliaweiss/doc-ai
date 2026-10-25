import { documentDataTbl } from "../../../schemas/documents";
import { zdocsDb } from "../../../db";
import { inArray } from "drizzle-orm";
import { extractLineItemFromEntityId } from "../extractLineItemFromEntityId";
import { getDateStr } from "@zdocs/util";
import type { EntityResponse } from "@zdocs/types";

export interface IndexResult {
  documentId: string;
  entityId: string;
  entityType: string;
  content: string;
  collectionKey: string | null;
  schemaType: string;
  documentDate: string | null;
  documentFileName: string | null;
  documentInstitutionName: string | null;
  documentCurrency: string | null;
  documentFolderId: string;
  // Preview fields - from search_index, all NOT NULL
  date: string;
  amount: number;
  currency: string;
  description: string;
  docType: string;
  isDataset: boolean;
}

/**
 * Process search results by fetching document data and building entity responses
 */
export async function processSearchResults(
  indexResults: IndexResult[]
): Promise<EntityResponse[]> {
  const documentIds = [...new Set(indexResults.map((r) => r.documentId))];
  const documentDataMap = new Map<
    string,
    {
      totalAmount: number | null;
      documentDate: string | null;
      headerData: Record<string, unknown> | null;
      lineItems: Record<string, Record<string, unknown>[]> | null;
    }
  >();

  if (documentIds.length > 0) {
    const dataResults = await zdocsDb
      .select({
        documentId: documentDataTbl.documentId,
        totalAmount: documentDataTbl.totalAmount,
        documentDate: documentDataTbl.documentDate,
        headerData: documentDataTbl.headerData,
        lineItems: documentDataTbl.lineItems,
      })
      .from(documentDataTbl)
      .where(inArray(documentDataTbl.documentId, documentIds))
      .execute();

    dataResults.forEach((d) =>
      documentDataMap.set(d.documentId, {
        totalAmount: d.totalAmount,
        documentDate: d.documentDate,
        headerData: d.headerData as Record<string, unknown> | null,
        lineItems: d.lineItems as Record<
          string,
          Record<string, unknown>[]
        > | null,
      })
    );
  }

  const results: EntityResponse[] = indexResults.map((result) => {
    const docData = documentDataMap.get(result.documentId);
    let data: Record<string, unknown> = {};

    const resultIsHeader = result.entityType === "HEADER";

    if (resultIsHeader) {
      if (docData) {
        data = docData.headerData ?? {};
        if (docData.totalAmount) {
          data.totalAmount = docData.totalAmount;
        }
      }
    } else {
      if (docData) {
        const lineItem = extractLineItemFromEntityId(
          result.entityId,
          result.documentId,
          result.collectionKey ?? null,
          docData.lineItems
        );

        if (lineItem) {
          data = { ...lineItem };
        }
      }
    }

    const parts = result.entityId.split("_");
    const isLineItem = result.entityType === "LINE_ITEM";
    const index =
      isLineItem && parts.length > 2 ? parseInt(parts[2], 10) : undefined;

    return {
      data,
      ref: {
        entityId: result.entityId,
        documentId: result.documentId,
        entityType: result.entityType as "HEADER" | "LINE_ITEM",
        schemaType: result.schemaType,
        collectionKey: result.collectionKey!,
        docType: result.docType,
        isDataset: result.isDataset,
        index,
        date: getDateStr(result.date)!,
      },
      preview: {
        date: getDateStr(result.date)!,
        amount: result.amount,
        currency: result.currency,
        description: result.description,
      },
    };
  });

  return results;
}
