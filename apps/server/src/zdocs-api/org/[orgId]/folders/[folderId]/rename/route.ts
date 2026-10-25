import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { renameFolder } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; folderId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, folderId } = await params;

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    const folder = await renameFolder(folderId, orgId, name.trim());

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Error renaming folder:", error);
    return NextResponse.json(
      { error: "Failed to rename folder" },
      { status: 500 }
    );
  }
}

