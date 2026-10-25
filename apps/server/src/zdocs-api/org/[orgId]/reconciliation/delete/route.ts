import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { deleteReconciliationLinkByRefs } from "@zdocs/db-schema";

/**
 * POST /api/org/[orgId]/reconciliation/delete
 * Delete a reconciliation link by source and target entity IDs (soft delete)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {

  const session = await getServerSession(authConfig);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  // Verify user has access to this org
  if (!(await userCanAccessOrgId(orgId, session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    console.log("delete reconciliation link body", body);

    const { sourceEntityId, targetEntityId } = body;

    if (!sourceEntityId || !targetEntityId) {
      return NextResponse.json(
        { error: "Missing required fields: sourceEntityId, targetEntityId" },
        { status: 400 }
      );
    }

    const deleted = await deleteReconciliationLinkByRefs(
      orgId,
      sourceEntityId,
      targetEntityId
    );

    if (!deleted) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reconciliation link:", error);
    return NextResponse.json(
      { error: "Failed to delete link" },
      { status: 500 }
    );
  }
}

