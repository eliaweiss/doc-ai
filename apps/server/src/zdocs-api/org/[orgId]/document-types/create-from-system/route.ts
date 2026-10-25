import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  restoreOrCreateDocumentTypeForOrg,
  generateAutoSumFields,
  mergeAutoSumFields,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import { getSystemDocumentType } from "@zdocs/types";

/**
 * POST /api/org/[orgId]/document-types/create-from-system
 * Create a document type from a system schema template
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authConfig);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    const { systemTypeName } = await req.json();

    if (!systemTypeName) {
      return NextResponse.json(
        { error: "systemTypeName is required" },
        { status: 400 }
      );
    }

    // Check if user can access this organization
    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the system document type
    const systemType = getSystemDocumentType(systemTypeName);
    if (!systemType) {
      return NextResponse.json(
        { error: `System type "${systemTypeName}" not found` },
        { status: 404 }
      );
    }

    // Generate auto sum fields for numeric line item columns
    const autoSumFields = generateAutoSumFields(systemType.lineItemSchemas);

    // Merge auto sum fields into header schema (preserves existing fields)
    const enrichedHeaderSchema = mergeAutoSumFields(
      systemType.headerSchema,
      autoSumFields
    );

    // Create or restore the document type (handles previously deleted types)
    const created = await restoreOrCreateDocumentTypeForOrg(orgId, {
      name: systemType.name,
      displayName: systemType.displayName,
      description: systemType.description,
      isSystem: true,
      headerSchema: enrichedHeaderSchema,
      lineItemSchemas: systemType.lineItemSchemas,
      icon: systemType.icon,
      color: systemType.color,
    });

    return NextResponse.json({
      documentType: created,
    });
  } catch (error: any) {
    console.error("Error creating document type:", error);

    // Check for unique constraint violation (type already exists)
    // The error code can be in error.code or error.cause.code depending on the error wrapper
    const errorCode = error?.code || error?.cause?.code;
    if (errorCode === "23505") {
      return NextResponse.json(
        {
          error:
            "Document type already exists (may have been deleted - contact support to restore)",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create document type" },
      { status: 500 }
    );
  }
}
