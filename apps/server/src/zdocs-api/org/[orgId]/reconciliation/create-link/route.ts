import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { createReconciliationLink } from "@zdocs/db-schema";
import type { CreateReconciliationLinkInput } from "@zdocs/types";

/**
 * POST /api/org/[orgId]/reconciliation/create-link
 * Create a new reconciliation link
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
    const body: CreateReconciliationLinkInput = await req.json();

    // Validate required fields
    if (!body.sourceRef || !body.targetRef || !body.amount || !body.currency) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: sourceRef, targetRef, amount, currency",
        },
        { status: 400 }
      );
    }

    // Validate refs have required fields
    if (
      !body.sourceRef.ref.schemaType ||
      !body.sourceRef.ref.entityType ||
      !body.sourceRef.ref.entityId
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid sourceRef: missing schemaType, entityType, or entityId",
        },
        { status: 400 }
      );
    }

    if (
      !body.targetRef.ref.docType ||
      !body.targetRef.ref.schemaType ||
      !body.targetRef.ref.entityType ||
      !body.targetRef.ref.entityId
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid targetRef: missing docType, schemaType, entityType, or entityId",
        },
        { status: 400 }
      );
    }

    const link = await createReconciliationLink(orgId, body, session.user?.id);

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("Error creating reconciliation link:", error);
    return NextResponse.json(
      { error: "Failed to create link" },
      { status: 500 }
    );
  }
}
