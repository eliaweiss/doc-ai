import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { moveFolder } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; folderId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, folderId } = await params;

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parentId } = await req.json();

    // Prevent moving folder into itself
    if (parentId === folderId) {
      return NextResponse.json(
        { error: "Cannot move folder into itself" },
        { status: 400 }
      );
    }

    const folder = await moveFolder(folderId, orgId, parentId || null);

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Error moving folder:", error);
    return NextResponse.json(
      { error: "Failed to move folder" },
      { status: 500 }
    );
  }
}
