import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import { getSavedQueryById, updateSavedQuery, deleteSavedQuery } from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import type { SavedQueryFilters } from "@zdocs/types";

interface UpdateSavedQueryBody {
  name?: string;
  query?: string;
  filters?: SavedQueryFilters | null;
}

// GET - Get a single saved query
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; queryId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, queryId } = await params;

    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const savedQuery = await getSavedQueryById(queryId, orgId, session.user.id);

    if (!savedQuery) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    return NextResponse.json(savedQuery);
  } catch (error) {
    console.error("Error getting saved query:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get query" },
      { status: 500 }
    );
  }
}

// PATCH - Update a saved query
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; queryId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, queryId } = await params;

    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateSavedQueryBody = await req.json();

    const updatedQuery = await updateSavedQuery({
      id: queryId,
      orgId,
      userId: session.user.id,
      ...body,
    });

    if (!updatedQuery) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    return NextResponse.json(updatedQuery);
  } catch (error) {
    console.error("Error updating saved query:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update query" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a saved query
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; queryId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, queryId } = await params;

    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deleted = await deleteSavedQuery(queryId, orgId, session.user.id);

    if (!deleted) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved query:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete query" },
      { status: 500 }
    );
  }
}

