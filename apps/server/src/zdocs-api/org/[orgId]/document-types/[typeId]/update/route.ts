import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { updateDocumentTypeForOrg } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

/**
 * POST /api/org/[orgId]/document-types/[typeId]/update
 * Update a document type for an organization
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; typeId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, typeId } = await params;
    const data = await req.json();

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update document type
    const updated = await updateDocumentTypeForOrg(orgId, typeId, data);

    if (!updated) {
      return NextResponse.json(
        { error: "Document type not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      documentType: updated,
    });
  } catch (error) {
    console.error("Error updating document type:", error);
    return NextResponse.json(
      { error: "Failed to update document type" },
      { status: 500 }
    );
  }
}

