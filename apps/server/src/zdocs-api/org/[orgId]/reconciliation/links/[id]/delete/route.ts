import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { deleteReconciliationLink } from "@zdocs/db-schema";

/**
 * DELETE /api/org/[orgId]/reconciliation/links/[id]
 * Delete a reconciliation link (soft delete)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> }
) {
  const session = await getServerSession(authConfig);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, id } = await params;

  // Verify user has access to this org
  if (!(await userCanAccessOrgId(orgId, session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteReconciliationLink(orgId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reconciliation link:", error);
    return NextResponse.json(
      { error: "Failed to delete link" },
      { status: 500 }
    );
  }
}
