import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import {
  getMiniAppForOrg,
  updateMiniAppForOrg,
  deleteMiniAppForOrg,
} from "@zdocs/db-schema";
import type { UpdateMiniAppParams } from "@zdocs/types";

/**
 * POST /api/org/[orgId]/mini-apps/[miniAppId]
 * Get a Mini App
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; miniAppId: string }> }
) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, miniAppId } = await params;

  // Verify user has access to this org
  if (!(await userCanAccessOrgId(orgId, session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const miniApp = await getMiniAppForOrg(orgId, miniAppId);

    if (!miniApp) {
      return NextResponse.json(
        { error: "Mini App not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ miniApp });
  } catch (error) {
    console.error("Error loading Mini App:", error);
    return NextResponse.json(
      { error: "Failed to load Mini App" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/org/[orgId]/mini-apps/[miniAppId]
 * Update a Mini App
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; miniAppId: string }> }
) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, miniAppId } = await params;

  // Verify user has access to this org
  if (!(await userCanAccessOrgId(orgId, session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: UpdateMiniAppParams = await req.json();

    const miniApp = await updateMiniAppForOrg(orgId, miniAppId, body);

    if (!miniApp) {
      return NextResponse.json(
        { error: "Mini App not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ miniApp });
  } catch (error) {
    console.error("Error updating Mini App:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update Mini App", details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/org/[orgId]/mini-apps/[miniAppId]
 * Delete a Mini App
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; miniAppId: string }> }
) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, miniAppId } = await params;

  // Verify user has access to this org
  if (!(await userCanAccessOrgId(orgId, session))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteMiniAppForOrg(orgId, miniAppId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Mini App not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Mini App:", error);
    return NextResponse.json(
      { error: "Failed to delete Mini App" },
      { status: 500 }
    );
  }
}
