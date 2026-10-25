import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { createMiniApp } from "@zdocs/db-schema";
import type { CreateMiniAppParams } from "@zdocs/types";

/**
 * POST /api/org/[orgId]/mini-apps/create
 * Create a new Mini App
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
    const body: Omit<CreateMiniAppParams, "orgId"> = await req.json();

    const miniApp = await createMiniApp({
      orgId,
      userId: session.user.id,
      name: body.name,
      description: body.description,
      color: body.color,
      icon: body.icon,
      code: body.code,
      isPublished: body.isPublished,
    });

    return NextResponse.json({ miniApp });
  } catch (error) {
    console.error("Error creating Mini App:", error);
    return NextResponse.json(
      { error: "Failed to create Mini App" },
      { status: 500 }
    );
  }
}
