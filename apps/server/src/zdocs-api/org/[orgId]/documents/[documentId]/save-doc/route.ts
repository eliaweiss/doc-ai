import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  getDocumentForOrg,
  updateDocumentDataForOrg,
  updateDocumentForOrg,
  getDocumentTypeByNameForOrg,
  getDocumentDataForOrg,
  indexDocument,
} from "@zdocs/db-schema";
import { getDenormalizedValues } from "@zdocs/types";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { DenormalizedValues } from "@zdocs/types";

/**
 * PUT /api/org/[orgId]/documents/[documentId]/save-doc
 * Update extracted data (user corrections)
 */
export async function PUT(
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

    // Parse request body
    const body = await req.json();
    const { headerData, lineItems } = body;

    // Fetch document (org-scoped)
    const document = await getDocumentForOrg(orgId, documentId);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get document type for denormalization (org-scoped)
    let documentType = null;
    if (document.docType) {
      documentType = await getDocumentTypeByNameForOrg(document.docType, orgId);
    }

    // Calculate denormalized values if we have the schema
    let denormalizedValues: DenormalizedValues = {
      amount: null,
      date: null,
      dueDate: null,
      currency: null,
      description: null,
    };
    if (documentType && headerData) {
      denormalizedValues = getDenormalizedValues(
        headerData,
        documentType.headerSchema
      );
    }

    // Update document_data
    const updateResult = await updateDocumentDataForOrg(orgId, documentId, {
      headerData: headerData !== undefined ? headerData : undefined,
      lineItems: lineItems !== undefined ? lineItems : undefined,
      totalAmount:
        denormalizedValues.amount !== null
          ? denormalizedValues.amount
          : undefined,
      documentDate:
        denormalizedValues.date !== null ? denormalizedValues.date : undefined,
      dueDate:
        denormalizedValues.dueDate !== null
          ? denormalizedValues.dueDate
          : undefined,
    });

    if (!updateResult) {
      return NextResponse.json(
        { error: "Document data not found" },
        { status: 404 }
      );
    }

    // Update document date if it changed
    if (denormalizedValues.date) {
      await updateDocumentForOrg(orgId, documentId, {
        documentDate: denormalizedValues.date,
      });
    }

    // Re-index the document (fire-and-forget)
    await indexDocument(documentId, orgId).catch((error) => {
      console.error(`Failed to re-index document ${documentId}:`, error);
    });

    // Fetch updated document data to return to client
    const updatedDocumentData = await getDocumentDataForOrg(orgId, documentId);

    if (!updatedDocumentData) {
      return NextResponse.json(
        { error: "Failed to fetch updated document data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentData: {
        id: updateResult.id,
        headerData: updatedDocumentData.headerData,
        lineItems: updatedDocumentData.lineItems,
        totalAmount: updatedDocumentData.totalAmount,
        documentDate: updatedDocumentData.documentDate,
        dueDate: updatedDocumentData.dueDate,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error updating document data:", error);
    return NextResponse.json(
      { error: "Failed to update document data" },
      { status: 500 }
    );
  }
}
