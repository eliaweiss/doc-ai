import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { setLineItemDuplicate } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

interface ToggleDuplicateRequest {
  entityId: string;
  isDuplicate: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; documentId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, documentId } = await params;

    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as ToggleDuplicateRequest;
    if (!body || typeof body.entityId !== "string" || typeof body.isDuplicate !== "boolean") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const result = await setLineItemDuplicate(
      orgId,
      documentId,
      body.entityId,
      body.isDuplicate
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to update duplicate flag" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      entityId: body.entityId,
      isDuplicate: body.isDuplicate,
    });
  } catch (error) {
    console.error("Error toggling duplicate:", error);
    return NextResponse.json(
      { error: "Failed to toggle duplicate" },
      { status: 500 }
    );
  }
}
