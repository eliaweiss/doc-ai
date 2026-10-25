import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { getDocumentTypesForOrg } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

/**
 * GET /api/org/[orgId]/document-types
 * List all document types for an organization (org-scoped, auto-seeded if empty)
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
    const { includeDatasets } = await req.json().catch(() => ({}));

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all document types for this org (system + custom)
    const documentTypes = await getDocumentTypesForOrg(orgId,{includeDatasets});

    return NextResponse.json({
      documentTypes,
      total: documentTypes.length,
    });
  } catch (error) {
    console.error("Error fetching document types:", error);
    return NextResponse.json(
      { error: "Failed to fetch document types" },
      { status: 500 }
    );
  }
}

// Note: POST, PUT, DELETE for custom document types will be implemented
// in a future phase. The schema infrastructure supports it, but the API is deferred.
