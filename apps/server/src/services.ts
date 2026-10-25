/**
 * Operations shared by the HTTP API and the MCP server.
 */
import {
  LOCAL_ORG_ID,
  countDocumentsByStatusForOrg,
  createDocumentTypeForOrg,
  enqueueDocument,
  getDocumentDataForOrg,
  getDocumentForOrg,
  getDocumentTypeByNameForOrg,
  getDocumentTypesForOrg,
  getNotificationsForDocument,
  getQueueStats,
  hasActiveJob,
  updateDocumentForOrg,
} from "@zdocs/db-schema";
import { deleteCacheByPrefix, getConfig } from "@zdocs/srv";
import {
  EXTRACTION_STATUSES,
  type FieldDefinition,
  type LineItemCollectionSchema,
} from "@zdocs/types";

export async function getStatus() {
  const config = getConfig();
  const counts = Object.fromEntries(
    await Promise.all(
      EXTRACTION_STATUSES.map(
        async (s) => [s, await countDocumentsByStatusForOrg(LOCAL_ORG_ID, s)] as const
      )
    )
  );
  return {
    watchDir: config.watchDir,
    dataDir: config.dataDir,
    provider: config.provider,
    model:
      config.provider === "ollama"
        ? config.ollamaModel
        : "AI Gateway",
    documentsByStatus: counts,
    queue: await getQueueStats(LOCAL_ORG_ID),
  };
}

export async function getDocumentDetail(documentId: string) {
  const document = await getDocumentForOrg(LOCAL_ORG_ID, documentId);
  if (!document) return null;
  const [data, notifications] = await Promise.all([
    getDocumentDataForOrg(LOCAL_ORG_ID, documentId),
    getNotificationsForDocument(LOCAL_ORG_ID, documentId),
  ]);
  return { document, data, notifications };
}

/**
 * Re-run classification + extraction for a document.
 */
export async function reprocessDocument(documentId: string, onEnqueued?: () => void) {
  const document = await getDocumentForOrg(LOCAL_ORG_ID, documentId);
  if (!document) throw new Error(`Document not found: ${documentId}`);
  if (await hasActiveJob(documentId)) return { queued: false, reason: "already queued" };

  await updateDocumentForOrg(LOCAL_ORG_ID, documentId, {
    extractionStatus: "PENDING",
    extractionErrors: null,
  });
  const job = await enqueueDocument(LOCAL_ORG_ID, documentId, "CLASSIFY");
  onEnqueued?.();
  return { queued: true, jobId: job.id };
}

/**
 * Re-run extraction with the document's current type (no re-classification),
 * so a type the user picked sticks. `force` drops cached extraction results.
 */
export async function reextractDocument(documentId: string, force: boolean, onEnqueued?: () => void) {
  const document = await getDocumentForOrg(LOCAL_ORG_ID, documentId);
  if (!document) throw new Error(`Document not found: ${documentId}`);
  if (!document.docType) return reprocessDocument(documentId, onEnqueued);
  if (await hasActiveJob(documentId)) return { queued: false, reason: "already queued" };

  if (force) await deleteCacheByPrefix(`extraction/${document.contentHash || document.s3Key}/`);
  await updateDocumentForOrg(LOCAL_ORG_ID, documentId, {
    extractionStatus: "PENDING",
    extractionErrors: null,
  });
  const job = await enqueueDocument(LOCAL_ORG_ID, documentId, "EXTRACT");
  onEnqueued?.();
  return { queued: true, jobId: job.id };
}

export async function listDocumentTypes() {
  const types = await getDocumentTypesForOrg(LOCAL_ORG_ID);
  return types.map((t) => ({
    name: t.name,
    displayName: t.displayName,
    description: t.description,
    isSystem: t.isSystem,
    isDataset: t.isDataset,
    headerFields: t.headerSchema.map((f) => f.name),
    lineItemCollections: Object.keys(t.lineItemSchemas ?? {}),
  }));
}

export async function getDocumentType(name: string) {
  return getDocumentTypeByNameForOrg(name, LOCAL_ORG_ID);
}

function collectCodeFields(
  headerSchema: FieldDefinition[],
  lineItemSchemas: Record<string, LineItemCollectionSchema> | null | undefined
): string[] {
  const names = headerSchema.filter((f) => f.type === "code").map((f) => f.name);
  for (const [key, collection] of Object.entries(lineItemSchemas ?? {})) {
    for (const f of collection.fields ?? []) {
      if (f.type === "code") names.push(`${key}.${f.name}`);
    }
  }
  return names;
}

/**
 * Create a custom document type (schema).
 * v1: schemas with `code` formula fields are rejected; see security-notes.md.
 */
export async function createDocumentType(input: {
  name: string;
  displayName: string;
  description?: string;
  extractionHint?: string;
  headerSchema: FieldDefinition[];
  lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
}) {
  const codeFields = collectCodeFields(input.headerSchema, input.lineItemSchemas);
  if (codeFields.length > 0) {
    throw new Error(
      `Code formula fields are not accepted yet (schema review is not implemented): ${codeFields.join(", ")}`
    );
  }
  const name = input.name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (await getDocumentTypeByNameForOrg(name, LOCAL_ORG_ID)) {
    throw new Error(`Document type ${name} already exists`);
  }
  return createDocumentTypeForOrg(LOCAL_ORG_ID, { ...input, name, isSystem: false });
}
