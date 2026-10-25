import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import {
  createQuickAccess,
  deleteQuickAccess,
  listQuickAccessForOrg,
  reorderQuickAccess,
  seedDefaultQuickAccess,
} from "@zdocs/db-schema";
import type { CreateQuickAccessParams } from "@zdocs/types";

/**
 * GET /api/org/[orgId]/quick-access
 * List all quick access items for the current user
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let items = await listQuickAccessForOrg(orgId, session.user.id);

    if (items.length === 0) {
      items = await seedDefaultQuickAccess(orgId, session.user.id);
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error listing quick access:", error);
    return NextResponse.json(
      { error: "Failed to list quick access" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/org/[orgId]/quick-access
 * Enable an app in quick access
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { appId, appType } = body;

    if (!appId || !appType) {
      return NextResponse.json(
        { error: "appId and appType are required" },
        { status: 400 }
      );
    }

    if (appType !== "system" && appType !== "mini_app") {
      return NextResponse.json(
        { error: "appType must be 'system' or 'mini_app'" },
        { status: 400 }
      );
    }

    const item = await createQuickAccess({
      orgId,
      userId: session.user.id,
      appId,
      appType,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error creating quick access:", error);
    return NextResponse.json(
      { error: "Failed to enable app" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/org/[orgId]/quick-access
 * Disable an app in quick access
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const appId = searchParams.get("appId");
    const appType = searchParams.get("appType") as "system" | "mini_app" | null;

    if (!appId || !appType) {
      return NextResponse.json(
        { error: "appId and appType query parameters are required" },
        { status: 400 }
      );
    }

    if (appType !== "system" && appType !== "mini_app") {
      return NextResponse.json(
        { error: "appType must be 'system' or 'mini_app'" },
        { status: 400 }
      );
    }

    await deleteQuickAccess(orgId, session.user.id, appId, appType);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quick access:", error);
    return NextResponse.json(
      { error: "Failed to disable app" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/org/[orgId]/quick-access
 * Reorder quick access items
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { itemIds } = body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "itemIds array is required" },
        { status: 400 }
      );
    }

    const items = await reorderQuickAccess(orgId, session.user.id, itemIds);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error reordering quick access:", error);
    return NextResponse.json(
      { error: "Failed to reorder apps" },
      { status: 500 }
    );
  }
}
