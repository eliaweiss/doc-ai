import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { deleteFolder, getFolderById } from "@zdocs/db-schema";
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

    // Check if folder exists and is not a system folder
    const folder = await getFolderById(folderId);
    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    if (folder.isSystem) {
      return NextResponse.json(
        { error: "Cannot delete system folders" },
        { status: 400 }
      );
    }

    const deleted = await deleteFolder(folderId, orgId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete folder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}

