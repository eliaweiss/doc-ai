import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { traceMoneyFlow } from "@zdocs/db-schema";
import type { TraceRequest } from "@zdocs/types";

/**
 * POST /api/org/[orgId]/reconciliation/trace
 * Trace money flow through reconciliation links
 */
export async function POST(
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
    const body: TraceRequest = await req.json();

    const traceResults = await traceMoneyFlow(orgId, body);

    return NextResponse.json(traceResults);
  } catch (error) {
    console.error("Error tracing money flow:", error);
    return NextResponse.json(
      { error: "Failed to trace money flow" },
      { status: 500 }
    );
  }
}

