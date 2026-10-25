import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  updateDocumentForOrg,
  updateDocumentDataForOrg,
  clearDocumentSearchIndex,
  getDocumentTypeByNameForOrg,
  getDocumentDataForOrg,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

interface ChangeTypeRequest {
  docType: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; documentId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, documentId } = await params;

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ChangeTypeRequest = await req.json();

    if (body.docType === undefined) {
      return NextResponse.json(
        { error: "docType is required" },
        { status: 400 }
      );
    }

    // Get the new document type if docType is provided
    let documentType = null;
    if (body.docType) {
      documentType = await getDocumentTypeByNameForOrg(body.docType, orgId);
      if (!documentType) {
        return NextResponse.json(
          { error: "Document type not found" },
          { status: 404 }
        );
      }
    }
    if (!body.docType) {
      return NextResponse.json(
        { error: "docType is required" },
        { status: 400 }
      );
    }

    // Update document with new docType and reset extraction status
    const updatedDocument = await updateDocumentForOrg(orgId, documentId, {
      docType: body.docType,
      extractionStatus: "PENDING",
    });

    if (!updatedDocument) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Clear document_data (headerData and lineItems become null)
    // Check if document_data exists first
    const existingData = await getDocumentDataForOrg(orgId, documentId);
    if (existingData) {
      await updateDocumentDataForOrg(orgId, documentId, {
        headerData: null,
        lineItems: null,
        totalAmount: null,
        dueDate: null,
      });
    }

    // Clear search index entries for this document
    await clearDocumentSearchIndex(documentId, orgId);

    // Fetch updated document data (should be null now)
    const documentData = await getDocumentDataForOrg(orgId, documentId);

    // Return updated document, document type, and cleared document data
    return NextResponse.json({
      document: updatedDocument,
      documentType: documentType
        ? {
          id: documentType.id,
          name: documentType.name,
          displayName: documentType.displayName,
          headerSchema: documentType.headerSchema,
          lineItemSchemas: documentType.lineItemSchemas,
        }
        : null,
      documentData: documentData
        ? {
          id: documentData.id,
          headerData: documentData.headerData,
          lineItems: documentData.lineItems,
          totalAmount: documentData.totalAmount,
          documentDate: documentData.documentDate
            ? String(documentData.documentDate)
            : null,
          dueDate: documentData.dueDate ? String(documentData.dueDate) : null,
        }
        : null,
    });
  } catch (error) {
    console.error("Error changing document type:", error);
    return NextResponse.json(
      { error: "Failed to change document type" },
      { status: 500 }
    );
  }
}
