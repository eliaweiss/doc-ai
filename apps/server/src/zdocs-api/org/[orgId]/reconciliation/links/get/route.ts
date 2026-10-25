import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import {
  createReconciliationLink,
  getReconciliationLinksForOrg,
} from "@zdocs/db-schema";
import type { CreateReconciliationLinkInput } from "@zdocs/types";

/**
 * GET /api/org/[orgId]/reconciliation/links
 * List all reconciliation links for the organization
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await getServerSession(authConfig);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  // Verify user has access to this org
  if (!(await userCanAccessOrgId(orgId, session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const links = await getReconciliationLinksForOrg(orgId);
    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error fetching reconciliation links:", error);
    return NextResponse.json(
      { error: "Failed to fetch links" },
      { status: 500 }
    );
  }
}

