import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { indexDocument, listDocumentsForOrg } from "@zdocs/db-schema";
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

    // Check org access
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all documents for this org
    const documents = await listDocumentsForOrg(orgId);

    let totalIndexed = 0;
    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    // Re-index each document
    for (const doc of documents) {
      try {
        const result = await indexDocument(doc.id, orgId);
        totalIndexed += result.indexed;
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          documentId: doc.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      documentsProcessed: documents.length,
      documentsSucceeded: successCount,
      documentsFailed: failedCount,
      totalEntitiesIndexed: totalIndexed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error reindexing documents:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reindex" },
      { status: 500 }
    );
  }
}

