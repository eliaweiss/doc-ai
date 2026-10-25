import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { updateDocumentForOrg } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

interface UpdateDocumentRequest {
  fileName?: string | null;
  institutionId?: string | null; // Institution name is looked up from institutions table
  currency?: string | null;
  description?: string | null;
  documentDate?: string | null;
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

    const body: UpdateDocumentRequest = await req.json();

    // Build update object with only provided fields
    const updateData: {
      fileName?: string | null;
      institutionId?: string | null;
      currency?: string | null;
      description?: string | null;
      documentDate?: string | null;
    } = {};

    if ("fileName" in body) {
      updateData.fileName = body.fileName ?? null;
    }
    if ("institutionId" in body) {
      updateData.institutionId = body.institutionId ?? null;
    }
    if ("currency" in body) {
      updateData.currency = body.currency ?? null;
    }
    if ("description" in body) {
      updateData.description = body.description ?? null;
    }
    if ("documentDate" in body) {
      // Parse date string to Date object, handling timezone correctly
      if (body.documentDate) {
        const match = body.documentDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const day = parseInt(match[3], 10);
          updateData.documentDate = `${year}-${month}-${day}`;
        }
      } else {
        updateData.documentDate = null;
      }
    }

    // Update the document using query function
    const document = await updateDocumentForOrg(orgId, documentId, updateData);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}
