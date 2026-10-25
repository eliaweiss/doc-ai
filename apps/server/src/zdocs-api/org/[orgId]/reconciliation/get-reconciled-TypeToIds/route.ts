import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/app/session-auth/auth-config";
import { userCanAccessOrgId } from "../../../functions/userCanAccessOrgId";
import { getReconciled_TypeToIds } from "@zdocs/db-schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { entityIds, targetEntityKey } = body;

    if (!entityIds || !Array.isArray(entityIds) || !targetEntityKey) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const reconciledIds = await getReconciled_TypeToIds(
      orgId,
      entityIds,
      targetEntityKey
    );
    return NextResponse.json({ reconciledIds });
  } catch (error) {
    console.error("Error in check-status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
