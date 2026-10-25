import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { updateNotificationStatus } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import type { NotificationStatus } from "@zdocs/types";

/**
 * PATCH /api/org/[orgId]/notifications/[notificationId]
 *
 * Update notification status (RESOLVED, IGNORED, PENDING).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; notificationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, notificationId } = await params;
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { status } = body as { status: NotificationStatus };

    if (!status || !["NEW", "PENDING", "RESOLVED", "IGNORED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be NEW, PENDING, RESOLVED, or IGNORED" },
        { status: 400 }
      );
    }

    // Update notification
    const updated = await updateNotificationStatus(orgId, notificationId, status);

    if (!updated) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ notification: updated });
  } catch (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}

