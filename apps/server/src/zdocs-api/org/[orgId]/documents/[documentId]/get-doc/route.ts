import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  getDocumentForOrg,
  getDocumentDataForOrg,
  getDocumentTypeByNameForOrg,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

/**
 * GET /api/org/[orgId]/documents/[documentId]/get-doc
 * Get extracted data (headerData + lineItems) for a document
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; documentId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, documentId } = await params;

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch document (org-scoped)
    const document = await getDocumentForOrg(orgId, documentId);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Fetch document_data (org-scoped)
    const documentData = await getDocumentDataForOrg(orgId, documentId);

    if (!documentData) {
      return NextResponse.json(
        { error: "Document data not found" },
        { status: 404 }
      );
    }

    // Fetch document type if available (org-scoped)
    let documentType = null;
    if (document.docType) {
      documentType = await getDocumentTypeByNameForOrg(document.docType, orgId);
    }

    return NextResponse.json({
      id: documentData.id,
      documentId,
      docType: document.docType,
      headerData: documentData.headerData,
      lineItems: documentData.lineItems,
      totalAmount: documentData.totalAmount,
      documentDate: documentData.documentDate,
      dueDate: documentData.dueDate,
      baseAmount: documentData.baseAmount,
      createdAt: documentData.createdAt,
      updatedAt: documentData.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching document data:", error);
    return NextResponse.json(
      { error: "Failed to fetch document data" },
      { status: 500 }
    );
  }
}
