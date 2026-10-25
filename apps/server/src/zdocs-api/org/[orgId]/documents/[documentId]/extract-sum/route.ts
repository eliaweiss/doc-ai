import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  getDocumentForOrg, getDocumentDataForOrg,
  getDocumentTypeByNameForOrg
} from "@zdocs/db-schema";
import {
  evaluateFormulas
} from "@zdocs/srv";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

/**
 * Unified extraction endpoint - Extraction stage.
 * Uses schema-driven extraction based on document type.
 * Uses AI Vision (document IMAGE) for extraction, not OCR text.
 *
 * Prerequisites:
 * - Document must have a docType (set during classification)
 * - Document should have document_data row (created during classification)
 *
 * Supports both:
 * - Session auth (for manual triggers from UI)
 * - CRON_SECRET auth (for queue daemon calls)
 *
 * Optional jobId in body for queue tracking.
 *
 * This endpoint:
 * 1. Fetches document and its type schema
 * 2. Fetches document image from S3
 * 3. Calls extractDocumentData with image + type schema (AI Vision)
 * 4. Updates existing document_data row with complete data
 * 5. Updates document.extractionStatus to EXTRACTED
 * 6. Triggers indexing
 * 7. Marks queue job as COMPLETED if jobId provided
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; documentId: string }> }
) {
  let jobId: string | undefined;

  try {
    const { orgId, documentId } = await params;

    // Parse optional jobId from body
    let body: { jobId?: string } = {};
    try {
      body = await req.json();
      jobId = body.jobId;
    } catch {
      // No body or not JSON - that's fine, jobId is optional
    }

    // Check authentication - allow either session or CRON_SECRET
    const authHeader = req.headers.get("Authorization");
    const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCronAuth) {
      // Require session auth for non-cron calls
      const session = await getServerSession(authConfig);
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Check if user can access this organization
      if (!(await userCanAccessOrgId(orgId, session))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 1. Get the document (org-scoped)
    const document = await getDocumentForOrg(orgId, documentId);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if document has a docType (should be set during classification)
    if (!document.docType) {
      return NextResponse.json(
        { error: "Document has no type. Classification may have failed." },
        { status: 400 }
      );
    }
    const documentData = await getDocumentDataForOrg(orgId, documentId);
    if (!documentData || !documentData.headerData || !documentData.lineItems) {
      return NextResponse.json(
        { error: "Document data not found" },
        { status: 404 }
      );
    }

    const documentType = await getDocumentTypeByNameForOrg(
      document.docType,
      orgId
    );
    if (!documentType) {
      return NextResponse.json(
        { error: "Document type not found" },
        { status: 404 }
      );
    }

    // 5.5 Evaluate formulas (sum fields, code fields, AI fields)
    // Execution order: sum → code → ai
    const formulaResult = await evaluateFormulas({
      documentType,
      extractedData: {
        headerData: documentData.headerData,
        lineItems: documentData.lineItems || {},
      },
      fileMetadata: {
        id: document.id,
        fileName: document.fileName || "",
        uploadDate: document.createdAt.toISOString(),
        fileType: document.contentType,
        status: document.extractionStatus,
      },
    });

    return NextResponse.json({
      success: true,
      documentId,
      sumData: formulaResult,
      jobId,
    });
  } catch (error) {
    console.error("Error extracting document data:", error);

    return NextResponse.json(
      { error: "Failed to extract document sum data" },
      { status: 500 }
    );
  }
}
