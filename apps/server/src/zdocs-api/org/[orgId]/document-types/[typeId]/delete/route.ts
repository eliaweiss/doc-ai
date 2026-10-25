import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { deleteDocumentTypeForOrg } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

/**
 * POST /api/org/[orgId]/document-types/[typeId]/delete
 * Soft delete a document type for an organization
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

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete document type
    const deleted = await deleteDocumentTypeForOrg(orgId, typeId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Document type not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting document type:", error);
    return NextResponse.json(
      { error: "Failed to delete document type" },
      { status: 500 }
    );
  }
}

