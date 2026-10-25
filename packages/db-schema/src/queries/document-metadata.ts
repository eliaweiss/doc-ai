import { eq, and } from "drizzle-orm";
import { nanoid } from "@zdocs/util";
import type { DocumentMetadata } from "@zdocs/types";
import { zdocsDb } from "../db";
import { documentMetadataTbl } from "../schemas/document-metadata";

export async function getDocumentMetadataForOrg(
  orgId: string,
  documentId: string,
  type: string
): Promise<DocumentMetadata | null> {
  const rows = await zdocsDb
    .select()
    .from(documentMetadataTbl)
    .where(
      and(
        eq(documentMetadataTbl.orgId, orgId),
        eq(documentMetadataTbl.documentId, documentId),
        eq(documentMetadataTbl.type, type)
      )
    )
    .limit(1);

  return (rows[0] as DocumentMetadata | undefined) ?? null;
}

export async function upsertDocumentMetadataForOrg(
  orgId: string,
  documentId: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  const existing = await getDocumentMetadataForOrg(orgId, documentId, type);
  const now = new Date();

  if (existing) {
    await zdocsDb
      .update(documentMetadataTbl)
      .set({ data, updatedAt: now })
      .where(
        and(
          eq(documentMetadataTbl.orgId, orgId),
          eq(documentMetadataTbl.documentId, documentId),
          eq(documentMetadataTbl.type, type)
        )
      );
    return;
  }

  await zdocsDb.insert(documentMetadataTbl).values({
    id: nanoid(),
    orgId,
    documentId,
    type,
    data,
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteDocumentMetadataForOrg(
  orgId: string,
  documentId: string,
  type: string
): Promise<void> {
  await zdocsDb
    .delete(documentMetadataTbl)
    .where(
      and(
        eq(documentMetadataTbl.orgId, orgId),
        eq(documentMetadataTbl.documentId, documentId),
        eq(documentMetadataTbl.type, type)
      )
    );
}
