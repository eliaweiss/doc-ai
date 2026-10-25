import { zdocsDb } from "../db";
import { documentTbl, documentDataTbl } from "../schemas/documents";
import { searchIndexTbl } from "../schemas/search";
import {
  eq,
  and,
  lt,
  isNull,
  desc,
  InferInsertModel,
  sql,
  or,
  inArray,
} from "drizzle-orm";
import type {
  Document,
  DocumentNotification,
  EntityType,
  ExtractionStatus,
  ReconciliationPairObj,
  TransactionType,
  BaseSearchIndex,
  DocumentData,
} from "@zdocs/types";
import {
  getSearchableFields,
  type FieldDefinition,
  type LineItemCollectionSchema,
} from "@zdocs/types";
import { getDocumentTypeByNameForOrg } from "./document-types";
import { reconciliationLinksTbl } from "../schemas/reconciliation-links";
import { getDateStr } from "@zdocs/util";
import { ensureItemBaseData, ensureDocumentBaseData } from "./documents-utils";

// Type for inserting a new document
type NewDocumentInsert = InferInsertModel<typeof documentTbl>;

// Check if we're running in Edge Runtime
const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

export async function getDocumentById(id: string): Promise<Document | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select()
    .from(documentTbl)
    .where(and(eq(documentTbl.id, id), isNull(documentTbl.deletedAt)))
    .limit(1)
    .execute();

  return (result[0] as Document | undefined) || null;
}

export async function deleteDocument(
  documentId: string,
  orgId: string
): Promise<boolean> {
  if (isEdgeRuntime) return false;

  const result = await zdocsDb
    .update(documentTbl)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt)
      )
    )
    .returning({ id: documentTbl.id });

  // If document was soft-deleted, also remove from search index
  if (result.length > 0) {
    await zdocsDb
      .delete(searchIndexTbl)
      .where(
        and(
          eq(searchIndexTbl.documentId, documentId),
          eq(searchIndexTbl.orgId, orgId)
        )
      );
    // also remove from reconciliation links
    await zdocsDb.delete(reconciliationLinksTbl).where(
      or(
        // Case 1: Current item is Source in the link
        and(
          sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'documentId' = ${documentId}`
        ),
        // Case 2: Current item is Target in the link
        and(
          sql`${reconciliationLinksTbl.targetRef}->'ref'->>'documentId' = ${documentId}`
        )
      )
    );
  }

  return result.length > 0;
}

/**
 * Hard delete a document and all related data from the system.
 * 
 * Cascade via FK: document_data, search_index, notifications, queue jobs
 * Explicit cleanup: reconciliation_links (JSONB references)
 * 
 * Returns the deleted document's S3 info for file cleanup, or null if not found.
 */
export async function hardDeleteDocument(
  documentId: string,
  orgId: string
): Promise<{ s3Key: string | null; s3Bucket: string | null; s3Region: string | null } | null> {
  if (isEdgeRuntime) return null;

  // 1. Fetch document to get S3 info before deletion
  const docResult = await zdocsDb
    .select({
      id: documentTbl.id,
      s3Key: documentTbl.s3Key,
      s3Bucket: documentTbl.s3Bucket,
      s3Region: documentTbl.s3Region,
    })
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId)
      )
    )
    .limit(1)
    .execute();

  if (docResult.length === 0) {
    return null;
  }

  const doc = docResult[0];

  // 2. Remove reconciliation links (JSONB references - not FK cascaded)
  await zdocsDb.delete(reconciliationLinksTbl).where(
    and(
      eq(reconciliationLinksTbl.orgId, orgId),
      or(
        sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'documentId' = ${documentId}`,
        sql`${reconciliationLinksTbl.targetRef}->'ref'->>'documentId' = ${documentId}`
      )
    )
  );

  // 3. Hard delete the document - FK cascades handle:
  //    document_data, search_index, notifications, queue jobs
  await zdocsDb
    .delete(documentTbl)
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId)
      )
    );

  return {
    s3Key: doc.s3Key,
    s3Bucket: doc.s3Bucket,
    s3Region: doc.s3Region,
  };
}

export type OldDocumentForCleanup = {
  id: string;
  fileName: string | null;
  createdAt: Date;
  s3Key: string | null;
  s3Bucket: string | null;
  s3Region: string | null;
};

/**
 * List documents older than the provided cutoff for one organization.
 * Used by cleanup scripts before hard deletion.
 */
export async function listDocumentsOlderThanForOrg(
  orgId: string,
  cutoffDate: Date,
  limit?: number
): Promise<OldDocumentForCleanup[]> {
  if (isEdgeRuntime) return [];

  const query = zdocsDb
    .select({
      id: documentTbl.id,
      fileName: documentTbl.fileName,
      createdAt: documentTbl.createdAt,
      s3Key: documentTbl.s3Key,
      s3Bucket: documentTbl.s3Bucket,
      s3Region: documentTbl.s3Region,
    })
    .from(documentTbl)
    .where(and(eq(documentTbl.orgId, orgId), lt(documentTbl.createdAt, cutoffDate)))
    .orderBy(desc(documentTbl.createdAt));

  if (limit) {
    return query.limit(limit).execute();
  }

  return query.execute();
}

/**
 * Count remaining documents in an org that reference the same S3 object.
 * This prevents deleting shared S3 objects while another document still uses them.
 */
export async function countDocumentsUsingS3ObjectForOrg(
  orgId: string,
  s3Bucket: string,
  s3Key: string
): Promise<number> {
  if (isEdgeRuntime) return 0;

  const result = await zdocsDb
    .select({ count: sql<number>`count(*)::int` })
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        eq(documentTbl.s3Bucket, s3Bucket),
        eq(documentTbl.s3Key, s3Key)
      )
    )
    .execute();

  return result[0]?.count ?? 0;
}

/**
 * Clear search index entries for a document (org-scoped)
 * Used when document type changes and old indexed data becomes invalid
 */
export async function clearDocumentSearchIndex(
  documentId: string,
  orgId: string
): Promise<void> {
  if (isEdgeRuntime) return;

  await zdocsDb
    .delete(searchIndexTbl)
    .where(
      and(
        eq(searchIndexTbl.documentId, documentId),
        eq(searchIndexTbl.orgId, orgId)
      )
    );
}

/**
 * Get all reconciliation links for a document
 * @param documentId - The document ID
 * @param orgId - The organization ID
 * @returns The reconciliation links
 */
export async function getReconciliationLinksForDocument(
  documentId: string,
  orgId: string
): Promise<ReconciliationPairObj[]> {
  return zdocsDb
    .select()
    .from(reconciliationLinksTbl)
    .where(
      and(
        eq(reconciliationLinksTbl.orgId, orgId),
        or(
          // Case 1: Current item is Source in the link
          and(
            sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'documentId' = ${documentId}`
          ),
          // Case 2: Current item is Target in the link
          and(
            sql`${reconciliationLinksTbl.targetRef}->'ref'->>'documentId' = ${documentId}`
          )
        )
      )
    );
}

/**
 * Index a document using the unified schema (document_data + document_types)
 * Creates search_index entries for:
 * - HEADER: searchable header fields + ALL line item content (allows searching for products to find parent documents)
 * - LINE_ITEM: searchable line item fields (individual line items)
 */
export async function indexDocument(
  documentId: string,
  orgId: string
): Promise<{ indexed: number }> {
  if (isEdgeRuntime) return { indexed: 0 };

  // Fetch the document with its type
  const documentResult = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  const document = documentResult[0];
  if (!document) {
    throw new Error("Document not found");
  }

  // Delete existing index entries for this document
  await zdocsDb
    .delete(searchIndexTbl)
    .where(eq(searchIndexTbl.documentId, documentId));

  // Document must have a docType to be indexed
  if (!document.docType) {
    console.log(`Document ${documentId} has no docType, skipping indexing`);
    return { indexed: 0 };
  }

  // Fetch document_data
  const dataResult = await zdocsDb
    .select()
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

  const documentData = dataResult[0];
  if (!documentData) {
    console.log(`No document_data found for document ${documentId}`);
    return { indexed: 0 };
  }

  // Fetch document type schema (org-scoped)
  const documentType = await getDocumentTypeByNameForOrg(
    document.docType,
    orgId
  );
  if (!documentType) {
    console.log(`Document type ${document.docType} not found for org ${orgId}`);
    return { indexed: 0 };
  }

  const indexEntries: Array<BaseSearchIndex> = [];

  // Collect all line item content first (needed for both individual entries and aggregated header)
  const lineItemSchemas = documentType.lineItemSchemas as Record<
    string,
    LineItemCollectionSchema
  > | null;
  const lineItems = documentData.lineItems as Record<
    string,
    Record<string, unknown>[]
  > | null;

  const allLineItemContents: string[] = [];

  if (lineItems && lineItemSchemas) {
    for (const [collectionKey, collectionSchema] of Object.entries(
      lineItemSchemas
    )) {
      const collectionData = lineItems[collectionKey];
      if (!collectionData) continue;

      const searchableFields = getSearchableFields(collectionSchema.fields);

      for (let i = 0; i < collectionData.length; i++) {
        const item = collectionData[i];
        const itemContent = searchableFields
          .map((f) => item[f.name])
          .filter((v) => v != null && v !== "" && v !== "null")
          .join(" ");
        if (!itemContent.trim()) continue;

        // Add to aggregated content for header
        allLineItemContents.push(itemContent);

        const { date, currency, amount, description } = ensureItemBaseData(
          item,
          collectionSchema,
          documentData,
          document
        );

        item.date = date;
        item.currency = currency;
        item.amount = amount;
        item.description = description;

        // if (!date) {
        //   throw new Error("Line item date is required");
        // }
        // if (!currency) {
        //   throw new Error("Line item currency is required");
        // }
        // if (!amount) {
        //   throw new Error("Line item amount is required");
        // }
        // if (!description) {
        //   throw new Error("Line item description is required");
        // }

        const entry: BaseSearchIndex = {
          // base data
          date,
          currency,
          amount,
          description,
          // type data
          orgId,
          documentId,
          entityId: `${documentId}_${collectionKey}_${i}`,
          entityType: "LINE_ITEM",
          content: (document.description || "") + ", " + itemContent,
          collectionKey: collectionKey,
          schemaType: `${document.docType}_${collectionKey}`,
          docType: document.docType!,
          isDataset: document.isDataset,
          isDuplicate: item.isDuplicate === true,
        };
        // Create individual line item entry
        indexEntries.push(entry);
      }
    }
  }

  // Index header searchable fields + all line item content
  const headerSchema = documentType.headerSchema as FieldDefinition[];
  const headerSearchableFields = getSearchableFields(headerSchema);
  const headerData = documentData.headerData as Record<string, unknown> | null;

  const headerFieldsContent = headerData
    ? headerSearchableFields
      .map((f) => headerData[f.name])
      .filter((v) => v != null && v !== "" && v !== "null")
      .join(" ")
    : "";

  // Combine header fields with all line item content
  const headerContent = [headerFieldsContent, ...allLineItemContents]
    .filter(Boolean)
    .join(" ");

  // Date priority for header: 1. header date, 2. document date, 3. upload date
  const headerDate = getDateStr(
    documentData.documentDate || document.documentDate || document.createdAt
  )!;

  // Datasets do not have a header, so we skip indexing it
  if (!document.isDataset && headerContent.trim()) {
    // if (!document.description) {
    //   throw new Error("Document description is required");
    // }
    // if (!document.currency) {
    //   throw new Error("Document currency is required");
    // }
    // if (!documentData.totalAmount) {
    //   throw new Error("Document total amount is required");
    // }
    const entry: BaseSearchIndex = {
      orgId,
      documentId,
      entityId: documentId,
      entityType: "HEADER",
      content: document.description + ", " + headerContent,
      collectionKey: null,
      schemaType: `${document.docType}_header`,
      docType: document.docType!,
      date: headerDate!,
      description: document.description || "",
      amount: documentData.totalAmount || 0,
      currency: document.currency || "",
      isDataset: document.isDataset,
      isDuplicate: false,
    };
    indexEntries.push(entry);
  }

  // Insert all index entries
  if (indexEntries.length > 0) {
    await zdocsDb.insert(searchIndexTbl).values(indexEntries);
  }

  // Update document status to INDEXED
  await zdocsDb
    .update(documentTbl)
    .set({
      extractionStatus: "INDEXED",
      lastIndexedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId)));

  return { indexed: indexEntries.length };
}

/**
 * Insert search index entries for an organization.
 */
export async function insertSearchIndexEntriesForOrg(
  orgId: string,
  entries: Array<{
    documentId: string;
    entityId: string;
    entityType: EntityType;
    content: string;
    collectionKey: string | null;
    schemaType: string;
    docType: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    isDataset: boolean;
    isDuplicate?: boolean;
  }>
): Promise<void> {
  if (isEdgeRuntime || entries.length === 0) return;

  const entriesWithOrg = entries.map((e) => ({ ...e, orgId }));

  // Chunk inserts to avoid large payload limits
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < entriesWithOrg.length; i += CHUNK_SIZE) {
    await zdocsDb
      .insert(searchIndexTbl)
      .values(entriesWithOrg.slice(i, i + CHUNK_SIZE));
  }
}

/**
 * Count documents for an organization (efficient count query)
 */
export async function countDocumentsForOrg(
  orgId: string,
  options?: { folderId?: string | null }
): Promise<number> {
  if (isEdgeRuntime) return 0;

  const conditions = [
    eq(documentTbl.orgId, orgId),
    isNull(documentTbl.deletedAt),
  ];

  if (options?.folderId !== undefined) {
    if (options.folderId === null) {
      conditions.push(isNull(documentTbl.folderId));
    } else {
      conditions.push(eq(documentTbl.folderId, options.folderId));
    }
  }

  const result = await zdocsDb
    .select({ count: sql<number>`count(*)::int` })
    .from(documentTbl)
    .where(and(...conditions))
    .execute();

  return result[0]?.count ?? 0;
}

/**
 * Count documents by extraction status for an organization (org-scoped)
 */
export async function countDocumentsByStatusForOrg(
  orgId: string,
  extractionStatus: ExtractionStatus
): Promise<number> {
  if (isEdgeRuntime) return 0;

  const result = await zdocsDb
    .select({ count: sql<number>`count(*)::int` })
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt),
        eq(documentTbl.extractionStatus, extractionStatus)
      )
    )
    .execute();

  return result[0]?.count ?? 0;
}

/**
 * List documents for an organization with optional folder filter
 */
export async function listDocumentsForOrg(
  orgId: string,
  options?: {
    folderId?: string | null;
    limit?: number;
    offset?: number;
    sortByUploadDate?: boolean;
  }
): Promise<Document[]> {
  if (isEdgeRuntime) return [];

  const conditions = [
    eq(documentTbl.orgId, orgId),
    isNull(documentTbl.deletedAt),
  ];

  // Filter by folderId if provided
  if (options?.folderId !== undefined) {
    if (options.folderId === null) {
      conditions.push(isNull(documentTbl.folderId));
    } else {
      conditions.push(eq(documentTbl.folderId, options.folderId));
    }
  }

  const orderByColumn = options?.sortByUploadDate
    ? desc(documentTbl.createdAt)
    : desc(documentTbl.documentDate);

  const baseQuery = zdocsDb
    .select({
      document: documentTbl,
      totalAmount: documentDataTbl.totalAmount,
    })
    .from(documentTbl)
    .leftJoin(documentDataTbl, eq(documentTbl.id, documentDataTbl.documentId))
    .where(and(...conditions))
    .orderBy(orderByColumn);

  const result =
    options?.limit !== undefined
      ? await baseQuery.limit(options.limit).offset(options.offset ?? 0)
      : await baseQuery;

  console.log("[listDocumentsForOrg] result count:", result.length, "orgId:", orgId);

  return result.map(({ document, totalAmount }) => {
    const fallbackDate = getDateStr(document.createdAt);
    const finalDate = document.documentDate || fallbackDate;
    const needsFallback = !document.documentDate || String(document.documentDate).trim() === "";
    if (needsFallback) {
      console.log("[listDocumentsForOrg] documentDate fallback (documentDate empty/null)", {
        documentId: document.id,
        documentDate: document.documentDate,
        createdAt: document.createdAt,
        createdAtType: typeof document.createdAt,
        fallbackDate,
        finalDate,
      });
    }
    return {
      ...document,
      documentDate: finalDate,
      metadata: {
        ...(document.metadata || {}),
        totalAmount,
      },
    };
  }) as Document[];
}

/**
 * Get the first INDEXED document for an organization (org-scoped)
 * Used for testing webhooks with real document data
 */
export async function getFirstIndexedDocumentForOrg(
  orgId: string
): Promise<Document | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        eq(documentTbl.extractionStatus, "INDEXED"),
        isNull(documentTbl.deletedAt)
      )
    )
    .orderBy(desc(documentTbl.lastIndexedAt))
    .limit(1)
    .execute();

  return (result[0] as Document | undefined) || null;
}

/**
 * Get sample documents by docType for an organization (org-scoped).
 * Returns up to `limit` extracted documents, ordered by most recent.
 */
export async function getSampleDocumentsByDocTypeForOrg(
  orgId: string,
  docType: string,
  limit: number = 5
): Promise<Document[]> {
  if (isEdgeRuntime) return [];

  const result = await zdocsDb
    .select({
      document: documentTbl,
      totalAmount: documentDataTbl.totalAmount,
    })
    .from(documentTbl)
    .leftJoin(documentDataTbl, eq(documentTbl.id, documentDataTbl.documentId))
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        eq(documentTbl.docType, docType),
        eq(documentTbl.extractionStatus, "INDEXED"),
        isNull(documentTbl.deletedAt)
      )
    )
    .orderBy(desc(documentTbl.documentDate))
    .limit(limit);

  return result.map(({ document, totalAmount }) => ({
    ...document,
    metadata: {
      ...(document.metadata || {}),
      totalAmount,
    },
  })) as Document[];
}

/**
 * Get a single document for an organization (org-scoped)
 */
export async function getDocumentForOrg(
  orgId: string,
  documentId: string
): Promise<Document | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select({
      document: documentTbl,
      totalAmount: documentDataTbl.totalAmount,
    })
    .from(documentTbl)
    .leftJoin(documentDataTbl, eq(documentTbl.id, documentDataTbl.documentId))
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  if (!result[0]) return null;

  const { document, totalAmount } = result[0];

  return {
    ...document,
    metadata: {
      ...(document.metadata || {}),
      totalAmount,
    },
  } as Document;
}

/**
 * Update a document's fields (org-scoped)
 */
export async function updateDocumentForOrg(
  orgId: string,
  documentId: string,
  data: Partial<{
    fileName: string | null;
    fileExtension: string | null;
    contentType: string;
    s3Key: string;
    contentHash: string | null;
    institutionId: string | null;
    currency: string | null;
    description: string | null;
    documentDate: string | null;
    folderId: string;
    docType: string;
    extractionStatus: ExtractionStatus;
    extractionErrors: Record<string, unknown> | null;
    lastExtractedAt: Date | null;
    lastIndexedAt: Date | null;
    uploadComplete: boolean;
    isDataset: boolean;
    pageCount: number | null;
  }>
): Promise<Document | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .update(documentTbl)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt)
      )
    )
    .returning();

  // index document
  await indexDocument(documentId, orgId);

  return (result[0] as Document | undefined) || null;
}

/**
 * Move a document to a different folder (org-scoped)
 */
export async function moveDocumentForOrg(
  orgId: string,
  documentId: string,
  folderId: string
): Promise<Document | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .update(documentTbl)
    .set({
      folderId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt)
      )
    )
    .returning();

  return (result[0] as Document | undefined) || null;
}

/**
 * Create a new document (org-scoped)
 */
export async function createDocumentForOrg(
  orgId: string,
  data: Omit<NewDocumentInsert, "orgId"> & { metadata?: Record<string, unknown> | null }
): Promise<Document> {
  if (isEdgeRuntime) throw new Error("Cannot create document in Edge Runtime");

  const [document] = await zdocsDb
    .insert(documentTbl)
    .values({
      orgId,
      contentType: data.contentType,
      s3Key: data.s3Key,
      s3Region: data.s3Region,
      s3Bucket: data.s3Bucket,
      fileName: data.fileName,
      fileExtension: data.fileExtension,
      contentHash: data.contentHash,
      folderId: data.folderId,
      isTest: data.isTest,
      metadata: data.metadata || null,
    })
    .returning();

  return document as Document;
}

/**
 * Mark a document's upload as complete
 * Note: This is an internal function that doesn't check orgId
 * because it's called after upload where we already verified access
 */
export async function markDocumentUploadComplete(
  documentId: string,
  uploadComplete: boolean,
  extractionStatus?: ExtractionStatus
): Promise<void> {
  if (isEdgeRuntime) return;

  const updateData: { uploadComplete: boolean; extractionStatus?: ExtractionStatus } = {
    uploadComplete,
  };
  if (extractionStatus) {
    updateData.extractionStatus = extractionStatus;
  }

  await zdocsDb
    .update(documentTbl)
    .set(updateData)
    .where(eq(documentTbl.id, documentId));
}

/**
 * Get document data (extracted content) for a document (org-scoped)
 */
export async function getDocumentDataForOrg(
  orgId: string,
  documentId: string
): Promise<DocumentData | null> {
  if (isEdgeRuntime) return null;

  const result = await zdocsDb
    .select()
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

  const data = result[0];
  if (!data) return null;

  return data;
}



/**
 * Check if document data exists (org-scoped)
 */
export async function documentDataExistsForOrg(
  orgId: string,
  documentId: string
): Promise<boolean> {
  if (isEdgeRuntime) return false;

  const result = await zdocsDb
    .select({ id: documentDataTbl.id })
    .from(documentDataTbl)
    .where(
      and(
        eq(documentDataTbl.documentId, documentId),
        eq(documentDataTbl.orgId, orgId)
      )
    )
    .limit(1)
    .execute();

  return result.length > 0;
}

/**
 * Create document data (org-scoped)
 * Also propagates description, currency, documentDate from headerData to documentTbl
 */
export async function createDocumentDataForOrg(
  orgId: string,
  documentId: string,
  data: {
    headerData?: Record<string, unknown> | null;
    lineItems?:
    | Record<string, unknown>[]
    | Record<string, Record<string, unknown>[]>
    | null;
    totalAmount?: number | null;
    transactionType?: TransactionType | null;
    documentDate?: string | null;
    dueDate?: string | null;
    notifications?: DocumentNotification[] | null;
    schemaEntityVersion?: number;
    headerSchema?: FieldDefinition[];
  }
): Promise<void> {
  if (isEdgeRuntime) return;

  console.log("[CreateDocumentDataForOrg] Creating document data", data);
  await zdocsDb.insert(documentDataTbl).values({
    orgId,
    documentId,
    ...(data.schemaEntityVersion !== undefined && {
      schemaEntityVersion: data.schemaEntityVersion,
    }),
    headerData: data.headerData || null,
    lineItems: (data.lineItems as any) || null,
    totalAmount: data.totalAmount || null,
    transactionType: data.transactionType || null,
    documentDate: data.documentDate || undefined,
    dueDate: data.dueDate || null,
    notifications: data.notifications || null,
  });

  // Propagate base data from headerData to documentTbl (fallback mechanism)
  // Get current document to apply fallback logic
  const documentResult = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  const document = documentResult[0];
  if (document) {
    const { description, currency, documentDate } = ensureDocumentBaseData(
      data.headerData,
      { totalAmount: data.totalAmount, documentDate: data.documentDate },
      document as Document,
      data.headerSchema
    );

    await zdocsDb
      .update(documentTbl)
      .set({
        description,
        currency,
        documentDate,
        updatedAt: new Date(),
      })
      .where(
        and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId))
      );
  }
}

/**
 * Update document data (org-scoped)
 */
export async function updateDocumentDataForOrg(
  orgId: string,
  documentId: string,
  data: {
    headerData?: Record<string, unknown> | null;
    lineItems?:
    | Record<string, unknown>[]
    | Record<string, Record<string, unknown>[]>
    | null;
    totalAmount?: number | null;
    transactionType?: TransactionType | null;
    documentDate?: string | undefined;
    dueDate?: string | null;
    notifications?: DocumentNotification[] | null;
    schemaEntityVersion?: number;
    headerSchema?: FieldDefinition[];
  }
): Promise<{ id: string } | null> {
  if (isEdgeRuntime) return null;

  // console.log("[UpdateDocumentDataForOrg] Updating document data", data);
  if (data.lineItems) {
    for (const [collectionName, items] of Object.entries(data.lineItems)) {
      const count = Array.isArray(items) ? items.length : 0;
      console.log(`lineItems: '${collectionName}' has ${count} items`);
    }
  }
  const result = await zdocsDb
    .update(documentDataTbl)
    .set({
      ...data,
      // null clears the line items (change-type), undefined leaves them
      lineItems: data.lineItems !== undefined ? (data.lineItems as any) : undefined,
      notifications:
        data.notifications !== undefined ? data.notifications : undefined,
      schemaEntityVersion:
        data.schemaEntityVersion !== undefined
          ? data.schemaEntityVersion
          : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentDataTbl.documentId, documentId),
        eq(documentDataTbl.orgId, orgId)
      )
    )
    .returning({ id: documentDataTbl.id });

  // Propagate base data from headerData to documentTbl (fallback mechanism)
  // Get current document to apply fallback logic
  const documentResult = await zdocsDb
    .select()
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.id, documentId),
        eq(documentTbl.orgId, orgId),
        isNull(documentTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  const document = documentResult[0];
  if (document) {
    const { description, currency, documentDate } = ensureDocumentBaseData(
      data.headerData,
      { totalAmount: data.totalAmount, documentDate: data.documentDate },
      document as Document,
      data.headerSchema
    );

    await zdocsDb
      .update(documentTbl)
      .set({
        description,
        currency,
        documentDate,
        institutionId: (data.headerData?.institutionId as string) || null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId))
      );
  }

  return result[0] || null;
}

/**
 * Upsert document data (org-scoped) - creates if not exists, updates if exists
 */
export async function upsertDocumentDataForOrg(
  orgId: string,
  documentId: string,
  data: {
    headerData?: Record<string, unknown> | null;
    lineItems?:
    | Record<string, unknown>[]
    | Record<string, Record<string, unknown>[]>
    | null;
    totalAmount?: number | null;
    transactionType?: TransactionType | null;
    documentDate?: string | undefined;
    dueDate?: string | null;
    notifications?: DocumentNotification[] | null;
    schemaEntityVersion?: number;
    headerSchema?: FieldDefinition[];
  }
): Promise<void> {
  if (isEdgeRuntime) return;

  const exists = await documentDataExistsForOrg(orgId, documentId);

  if (exists) {
    await updateDocumentDataForOrg(orgId, documentId, data);
  } else {
    await createDocumentDataForOrg(orgId, documentId, data);
  }
}

/**
 * Set document extraction status to RETRYING (org-scoped)
 * Used when a job fails but will be retried automatically
 */
export async function setDocumentExtractionPartial(
  orgId: string,
  documentId: string
): Promise<void> {
  if (isEdgeRuntime) return;

  await zdocsDb
    .update(documentTbl)
    .set({
      extractionStatus: "PARTIAL" as ExtractionStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId)));
}

export async function setDocumentExtractionRetrying(
  orgId: string,
  documentId: string,
  errorMessage: string,
  stage: "classification" | "extraction"
): Promise<void> {
  if (isEdgeRuntime) return;

  await zdocsDb
    .update(documentTbl)
    .set({
      extractionStatus: "RETRYING" as ExtractionStatus,
      extractionErrors: {
        error: errorMessage,
        stage,
        timestamp: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId)));
}

/**
 * Set document extraction status to FAILED (org-scoped)
 */
export async function setDocumentExtractionFailed(
  orgId: string,
  documentId: string,
  errorMessage: string,
  stage: "classification" | "extraction"
): Promise<void> {
  if (isEdgeRuntime) return;

  await zdocsDb
    .update(documentTbl)
    .set({
      extractionStatus: "FAILED" as ExtractionStatus,
      extractionErrors: {
        error: errorMessage,
        stage,
        timestamp: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId)));
}

/**
 * Update document after classification (org-scoped)
 */
export async function updateDocumentClassification(
  orgId: string,
  documentId: string,
  data: {
    docType: string;
    description?: string | null;
    documentDate?: string | null;
  }
): Promise<void> {
  if (isEdgeRuntime) return;

  await zdocsDb
    .update(documentTbl)
    .set({
      docType: data.docType,
      description: data.description,
      documentDate: data.documentDate,
      extractionStatus: "PARTIAL" as ExtractionStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId)));
}

/**
 * Update document after extraction (org-scoped)
 */
export async function updateDocumentExtraction(
  orgId: string,
  documentId: string,
  data: {
    documentDate?: string | null;
    currency?: string | null;
    institutionId?: string | null;
  }
): Promise<void> {
  if (isEdgeRuntime) return;

  await zdocsDb
    .update(documentTbl)
    .set({
      extractionStatus: "EXTRACTED" as ExtractionStatus,
      lastExtractedAt: new Date(),
      documentDate: data.documentDate,
      currency: data.currency,
      institutionId: data.institutionId,
      updatedAt: new Date(),
    })
    .where(and(eq(documentTbl.id, documentId), eq(documentTbl.orgId, orgId)));
}

/**
 * Get extraction statuses for multiple documents
 * @param orgId - The organization ID
 * @param documentIds - Array of document IDs to fetch statuses for
 * @returns Array of objects with id and extractionStatus
 */
export async function getDocumentStatuses(
  orgId: string,
  documentIds: string[]
): Promise<Array<{ id: string; extractionStatus: ExtractionStatus }>> {
  if (isEdgeRuntime) return [];
  if (documentIds.length === 0) return [];

  const result = await zdocsDb
    .select({
      id: documentTbl.id,
      extractionStatus: documentTbl.extractionStatus,
    })
    .from(documentTbl)
    .where(
      and(
        eq(documentTbl.orgId, orgId),
        inArray(documentTbl.id, documentIds),
        isNull(documentTbl.deletedAt)
      )
    )
    .execute();

  return result;
}
