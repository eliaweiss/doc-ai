import { listDocumentsForOrg } from "@zdocs/db-schema";
import type { ListDocumentsResponse } from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

interface ListDocumentsParams {
  orgId: string; // Required but validated at route level
  docType?: string | string[];
  folderId?: string | string[];
  date?: { gte?: string; lte?: string };
  amount?: { gte?: number; lte?: number };
  currency?: string | string[];
  isDataset?: boolean;
  orderBy?: {
    field: "documentDate" | "createdAt" | "totalAmount";
    dir: "asc" | "desc";
  };
  limit?: number;
  offset?: number;
}

/**
 * List documents with filters
 */
export async function handleListDocuments(
  context: UiTxContext,
  params: ListDocumentsParams
): Promise<ListDocumentsResponse> {
  const { orgId } = context;
  const { folderId } = params;

  // Get documents
  const documents = await listDocumentsForOrg(orgId, {
    folderId:
      folderId !== undefined
        ? Array.isArray(folderId)
          ? folderId[0]
          : folderId
        : undefined,
  });

  // Apply filters
  let filtered = documents;

  if (params.docType) {
    const docTypes = Array.isArray(params.docType)
      ? params.docType
      : [params.docType];
    filtered = filtered.filter(
      (doc) => doc.docType && docTypes.includes(doc.docType)
    );
  }

  if (params.date?.gte) {
    filtered = filtered.filter((doc) => {
      if (!doc.documentDate) return false;
      return doc.documentDate >= params.date!.gte!;
    });
  }

  if (params.date?.lte) {
    filtered = filtered.filter((doc) => {
      if (!doc.documentDate) return false;
      return doc.documentDate <= params.date!.lte!;
    });
  }

  if (params.currency) {
    const currencies = Array.isArray(params.currency)
      ? params.currency
      : [params.currency];
    filtered = filtered.filter(
      (doc) => doc.currency && currencies.includes(doc.currency)
    );
  }

  // Apply ordering
  if (params.orderBy) {
    filtered.sort((a, b) => {
      let aVal: string | number | Date;
      let bVal: string | number | Date;

      switch (params.orderBy!.field) {
        case "documentDate":
          aVal = a.documentDate || "";
          bVal = b.documentDate || "";
          break;
        case "createdAt":
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
        case "totalAmount":
          aVal = (a.metadata as { totalAmount?: number })?.totalAmount || 0;
          bVal = (b.metadata as { totalAmount?: number })?.totalAmount || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return params.orderBy!.dir === "asc" ? -1 : 1;
      if (aVal > bVal) return params.orderBy!.dir === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Apply pagination
  const offset = params.offset || 0;
  const limit = params.limit || 50;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    total: filtered.length,
    documents: paginated.map((doc) => ({
      id: doc.id,
      docType: doc.docType || "",
      documentDate: doc.documentDate || undefined,
      description: doc.description || undefined,
      currency: doc.currency || undefined,
      totalAmount:
        (doc.metadata as { totalAmount?: number })?.totalAmount || undefined,
      folderId: doc.folderId || undefined,
      extractionStatus: doc.extractionStatus,
    })),
  };
}
