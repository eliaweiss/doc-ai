import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/app/session-auth/auth-config";
import { userCanAccessOrgId } from "../../../functions/userCanAccessOrgId";
import { searchByEntity } from "@zdocs/db-schema";

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

    // Parse request body
    const body = await req.json();
    const {
      query,
      entity,
      limit,
      offset,
      dateFrom,
      dateTo,
      excludeReconciled,
      reconciliationTargetEntity,
      exactMatch,
    } = body;

    // Query is optional - if empty, it returns latest documents
    // if (!query || typeof query !== "string") {
    //   return NextResponse.json({ error: "Query is required" }, { status: 400 });
    // }

    // Validate entity object
    if (
      !entity ||
      !entity.schemaType ||
      !entity.docType ||
      !entity.entityType
    ) {
      return NextResponse.json(
        {
          error:
            "entity is required and must include schemaType, docType, and entityType",
        },
        { status: 400 }
      );
    }

    // Build filters object with new nested structure
    const filters: {
      preview?: {
        date?: { gte?: string; lte?: string };
      };
      entity?: {
        schemaType?: string | string[];
      };
    } = {};

    // Build preview filters
    if (dateFrom || dateTo) {
      filters.preview = {
        date: {},
      };
      if (dateFrom) filters.preview.date!.gte = dateFrom;
      if (dateTo) filters.preview.date!.lte = dateTo;
    }

    // Build entity filters
    if (entity) {
      filters.entity = {};
      if (entity.schemaType) {
        filters.entity.schemaType = entity.schemaType;
      }
    }

    // Execute search
    const result = await searchByEntity({
      query: query || "",
      orgId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      excludeReconciled: excludeReconciled,
      reconciliationTargetEntity: reconciliationTargetEntity || undefined,
      exactMatch: exactMatch || false,
    });

    return NextResponse.json({ ...result });
  } catch (error) {
    console.error("Error in entity search:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
