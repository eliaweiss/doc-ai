import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { indexDocument } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

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

    // Check org access
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Index the document
    const result = await indexDocument(documentId, orgId);

    return NextResponse.json({
      success: true,
      indexed: result.indexed,
      message: `Indexed ${result.indexed} entities`,
    });
  } catch (error) {
    console.error("Error indexing document:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to index document",
      },
      { status: 500 }
    );
  }
}
