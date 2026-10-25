import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { getReconciliationLinksForDocument } from "@zdocs/db-schema";

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

    // Delete the document (soft delete)
    const links = await getReconciliationLinksForDocument(documentId, orgId);

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error getting reconciliation links for document:", error);
    return NextResponse.json(
      { error: "Failed to get reconciliation links for document" },
      { status: 500 }
    );
  }
}
