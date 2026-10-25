import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  updateOrganization,
  getOrCreateWebhookId,
  getOrganizationById,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

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

    const {
      name,
      description,
      baseCurrency,
      timezone,
      sharedWithEmails,
      webhookSecret,
      webhookCallbackUrl,
      webhookSigningSecret,
      emailForwardAddress,
      emailForwardEnabled,
      emailNotifyOnUpload,
      color,
    } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Update the organization using query function
    const organization = await updateOrganization(orgId, {
      name: name.trim(),
      description: description?.trim() || null,
      baseCurrency: baseCurrency || "USD",
      timezone: timezone || "UTC",
      sharedWithEmails: Array.isArray(sharedWithEmails)
        ? sharedWithEmails
        : undefined,
      webhookSecret:
        webhookSecret !== undefined ? webhookSecret || null : undefined,
      webhookCallbackUrl:
        webhookCallbackUrl !== undefined
          ? webhookCallbackUrl || null
          : undefined,
      webhookSigningSecret:
        webhookSigningSecret !== undefined
          ? webhookSigningSecret || null
          : undefined,
      emailForwardAddress:
        emailForwardAddress !== undefined
          ? emailForwardAddress || null
          : undefined,
      emailForwardEnabled:
        emailForwardEnabled !== undefined ? emailForwardEnabled : undefined,
      emailNotifyOnUpload:
        emailNotifyOnUpload !== undefined ? emailNotifyOnUpload : undefined,
      color: color !== undefined ? color || null : undefined,
    });

    // Ensure webhookId exists (will be created if missing)
    if (organization) {
      await getOrCreateWebhookId(orgId);
      // Fetch updated organization to get webhookId
      const updatedOrg = await getOrganizationById(orgId);
      return NextResponse.json({ organization: updatedOrg || organization });
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
