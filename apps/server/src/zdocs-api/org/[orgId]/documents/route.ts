import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { countDocumentsForOrg, listDocumentsForOrg } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  console.log("[documents/route] POST received", { url: req.url });
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    const body = await req.json().catch(() => ({}));
    const folderId = body?.folderId;
    const sortByUploadDate = body?.sortByUploadDate === true;
    const limit =
      typeof body?.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(1, Math.floor(body.limit))
        : undefined;
    const offset =
      typeof body?.offset === "number" && Number.isFinite(body.offset)
        ? Math.max(0, Math.floor(body.offset))
        : 0;

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queryOptions = {
      folderId: folderId !== undefined ? folderId : undefined,
      limit,
      offset,
      sortByUploadDate,
    };

    // Get documents for this organization (optionally filtered by folder and paginated)
    console.log("[documents/route] calling listDocumentsForOrg", { orgId, queryOptions });
    const documents = await listDocumentsForOrg(orgId, {
      ...queryOptions,
    });
    console.log("[documents/route] listDocumentsForOrg returned", documents.length, "documents");
    const total =
      limit !== undefined
        ? await countDocumentsForOrg(orgId, {
            folderId: queryOptions.folderId,
          })
        : documents.length;
    const hasMore = limit !== undefined ? offset + documents.length < total : false;

    return NextResponse.json({ documents, total, hasMore });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
