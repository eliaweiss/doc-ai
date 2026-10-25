import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/app/session-auth/auth-config";
import { getSearchableEntitiesForOrg } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "../../../functions/userCanAccessOrgId";

export async function GET(
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

    // Get all searchable entities for the org
    const entities = await getSearchableEntitiesForOrg(orgId);

    return NextResponse.json({ entities });
  } catch (error) {
    console.error("Error fetching searchable entities:", error);
    return NextResponse.json(
      { error: "Failed to fetch searchable entities" },
      { status: 500 }
    );
  }
}
