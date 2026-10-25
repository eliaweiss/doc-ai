import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  getDocumentForOrg,
  getDocumentDataForOrg,
  getDocumentTypeByNameForOrg,
  getFolderPathForOrg,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { enrichLineItemsWithMetadata } from "@zdocs/srv";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; documentId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, documentId } = await params;

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the document (org-scoped)
    const document = await getDocumentForOrg(orgId, documentId);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get document_data (extracted content)
    const documentData = await getDocumentDataForOrg(orgId, documentId);

    // Get document type info if available (org-scoped)
    let documentType = null;
    if (document.docType) {
      documentType = await getDocumentTypeByNameForOrg(document.docType, orgId);
    }

    // Build folder path (breadcrumbs)
    const folderPath = document.folderId
      ? await getFolderPathForOrg(orgId, document.folderId)
      : [];

    // Enrich line items with metadata
    enrichLineItemsWithMetadata(documentData, document, documentType);

    return NextResponse.json({
      document,
      documentData,
      documentType: documentType
        ? {
          id: documentType.id,
          name: documentType.name,
          displayName: documentType.displayName,
          headerSchema: documentType.headerSchema,
          lineItemSchemas: documentType.lineItemSchemas,
        }
        : null,
      folderPath,
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}
