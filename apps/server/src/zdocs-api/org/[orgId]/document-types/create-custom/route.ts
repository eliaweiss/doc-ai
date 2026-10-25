import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  createDocumentTypeForOrg,
  hardDeleteDocumentTypesByNameForOrg,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

/**
 * POST /api/org/[orgId]/document-types/create-custom
 * Create a new custom document type for an organization
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    const {
      name,
      displayName,
      description,
      extractionHint,
      headerSchema,
      lineItemSchemas,
      sampleDocuments,
      icon,
      color,
    } = await req.json();

    console.log(`[create-custom-document-type] Starting creation for orgId: ${orgId}, name: ${name}, displayName: ${displayName}`);
    console.log(`[create-custom-document-type] Header schema fields: ${headerSchema?.length || 0}`);
    console.log(`[create-custom-document-type] Line item schemas: ${lineItemSchemas ? Object.keys(lineItemSchemas).join(", ") : "none"}`);
    if (lineItemSchemas) {
      Object.entries(lineItemSchemas).forEach(([key, schema]: [string, any]) => {
        console.log(`[create-custom-document-type]   - Collection "${key}": ${schema?.fields?.length || 0} fields`);
      });
    }
    console.log(`[create-custom-document-type] Sample documents: ${sampleDocuments?.length || 0}`);

    if (sampleDocuments && Array.isArray(sampleDocuments)) {
      const expectedBucket = process.env.AWS_BUCKET_NAME;
      const expectedRegion = process.env.S3_REGION;
      const expectedKeyPrefix = `samples/${orgId}/`;

      console.log(`[create-custom-document-type] Validating ${sampleDocuments.length} sample documents`);
      for (const sample of sampleDocuments) {
        if (
          !sample?.s3Key ||
          !sample?.fileName ||
          !sample?.contentType ||
          !sample?.s3Region ||
          !sample?.s3Bucket ||
          !expectedBucket ||
          !expectedRegion ||
          sample.s3Bucket !== expectedBucket ||
          sample.s3Region !== expectedRegion ||
          !sample.s3Key.startsWith(expectedKeyPrefix)
        ) {
          console.error(`[create-custom-document-type] Invalid sample document reference:`, sample);
          return NextResponse.json(
            { error: "Invalid sample document reference" },
            { status: 400 }
          );
        }
      }
      console.log(`[create-custom-document-type] All sample documents validated successfully`);
    }

    // Validate required fields
    if (!name || !displayName) {
      console.error(`[create-custom-document-type] Missing required fields: name=${!!name}, displayName=${!!displayName}`);
      return NextResponse.json(
        { error: "Name and displayName are required" },
        { status: 400 }
      );
    }

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      console.error(`[create-custom-document-type] User ${session.user.email} cannot access orgId: ${orgId}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete any existing rows (active or soft-deleted) with the same name first.
    // The DB unique index is (org_id, name), so soft-deleted rows still collide.
    console.log(`[create-custom-document-type] Deleting any existing document types with name: ${name}`);
    await hardDeleteDocumentTypesByNameForOrg(orgId, name);

    // Create the custom document type
    let documentType;
    try {
      console.log(`[create-custom-document-type] Creating document type with headerSchema: ${headerSchema?.length || 0} fields, lineItemSchemas: ${lineItemSchemas ? Object.keys(lineItemSchemas).length : 0} collections`);
      documentType = await createDocumentTypeForOrg(orgId, {
        name,
        displayName,
        description: description || undefined,
        extractionHint: extractionHint || undefined,
        isDataset: false,
        isSystem: false,
        headerSchema: headerSchema || [],
        lineItemSchemas: lineItemSchemas || null,
        sampleDocuments: sampleDocuments || null,
        icon: icon || undefined,
        color: color || "#6366f1", // Default indigo color
      });
      console.log(`[create-custom-document-type] Successfully created document type with id: ${documentType.id}`);
    } catch (error) {
      // Defensive retry in case another stale duplicate row appears between delete and insert.
      const cause = error instanceof Error ? (error as { cause?: { code?: string } }).cause : undefined;
      if (cause?.code !== "23505") {
        console.error(`[create-custom-document-type] Error creating document type:`, error);
        throw error;
      }

      console.log(`[create-custom-document-type] Retrying after duplicate key error (code: ${cause.code})`);
      await hardDeleteDocumentTypesByNameForOrg(orgId, name);
      documentType = await createDocumentTypeForOrg(orgId, {
        name,
        displayName,
        description: description || undefined,
        extractionHint: extractionHint || undefined,
        isDataset: false,
        isSystem: false,
        headerSchema: headerSchema || [],
        lineItemSchemas: lineItemSchemas || null,
        sampleDocuments: sampleDocuments || null,
        icon: icon || undefined,
        color: color || "#6366f1",
      });
      console.log(`[create-custom-document-type] Successfully created document type on retry with id: ${documentType.id}`);
    }

    return NextResponse.json({ documentType });
  } catch (error) {
    console.error("[create-custom-document-type] Error creating custom document type:", error);
    return NextResponse.json(
      { error: "Failed to create document type" },
      { status: 500 }
    );
  }
}

