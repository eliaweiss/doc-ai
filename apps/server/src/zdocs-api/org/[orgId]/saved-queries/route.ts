import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { createSavedQuery, listSavedQueries } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import type { SavedQueryFilters } from "@zdocs/types";

interface CreateSavedQueryBody {
  name: string;
  query: string;
  filters: SavedQueryFilters | null;
}

// POST - Create a new saved query
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

    const body: CreateSavedQueryBody = await req.json();
    const { name, query, filters } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Query name is required" },
        { status: 400 }
      );
    }

    // NOTE: Query is NOT required
    // if (!query || !query.trim()) {
    //   return NextResponse.json(
    //     { error: "Query text is required" },
    //     { status: 400 }
    //   );
    // }

    const savedQuery = await createSavedQuery({
      orgId,
      userId: session.user.id,
      name: name.trim(),
      query: query.trim(),
      filters,
    });

    return NextResponse.json(savedQuery);
  } catch (error) {
    console.error("Error creating saved query:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save query",
      },
      { status: 500 }
    );
  }
}

// GET - List all saved queries for the current user
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

    const queries = await listSavedQueries(orgId, session.user.id);

    return NextResponse.json({ queries });
  } catch (error) {
    console.error("Error listing saved queries:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list queries",
      },
      { status: 500 }
    );
  }
}
