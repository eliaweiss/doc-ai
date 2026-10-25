import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { listMiniAppsForOrg } from "@zdocs/db-schema";

/**
 * POST /api/org/[orgId]/mini-apps/list-miniapps
 * List all Mini Apps for an organization
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  // Verify user has access to this org
  if (!(await userCanAccessOrgId(orgId, session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const miniApps = await listMiniAppsForOrg(orgId);

    return NextResponse.json({ miniApps });
  } catch (error) {
    console.error("Error listing Mini Apps:", error);
    return NextResponse.json(
      { error: "Failed to list Mini Apps" },
      { status: 500 }
    );
  }
}
