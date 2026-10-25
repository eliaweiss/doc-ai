import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { createFolder, getFoldersByOrgId } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, parentId, type, description, color } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Prevent duplicate root folders (e.g., "My Drive")
    if (!parentId && name.trim() === "My Drive") {
      const existingFolders = await getFoldersByOrgId(orgId);
      const existingRoot = existingFolders.find(
        (f) => f.isRoot || (!f.parentId && f.name === "My Drive")
      );
      if (existingRoot) {
        // Return existing folder instead of creating duplicate
        return NextResponse.json({ folder: existingRoot });
      }
    }

    const folder = await createFolder({
      orgId,
      name: name.trim(),
      parentId: parentId || null,
      type: type || "GENERAL",
      isRoot: parentId === null,
      description: description || null,
      color: color || null,
    });

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
