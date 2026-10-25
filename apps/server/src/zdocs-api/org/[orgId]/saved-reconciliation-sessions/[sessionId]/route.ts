import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  getSavedReconciliationSessionById,
  updateSavedReconciliationSession,
  deleteSavedReconciliationSession,
  getSearchableEntitiesForOrg,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import type {
  SearchableEntityOption,
  ReconciliationSessionOptions,
} from "@zdocs/types";

interface UpdateSavedReconciliationSessionBody {
  name?: string;
  description?: string;
  sourceEntity?: SearchableEntityOption;
  sourceQuery?: string;
  sourceDateFrom?: string;
  sourceDateTo?: string;
  targetEntity?: SearchableEntityOption;
  targetQuery?: string;
  targetDateFrom?: string;
  targetDateTo?: string;
  amount?: string;
  currency?: string;
  options?: ReconciliationSessionOptions | null;
}

function resolveSessionEntities(
  session: {
    sourceEntityKey: string;
    targetEntityKey: string;
    options?: ReconciliationSessionOptions | null;
    [key: string]: unknown;
  },
  entityMap: Map<string, SearchableEntityOption>
) {
  const sourceEntity = entityMap.get(session.sourceEntityKey);
  const targetEntity = entityMap.get(session.targetEntityKey);

  if (!sourceEntity || !targetEntity) {
    return null;
  }

  const sourceEntities =
    session.options?.sourceEntityKeys
      ?.map((key) => entityMap.get(key))
      .filter((entity): entity is SearchableEntityOption => Boolean(entity)) ||
    [sourceEntity];
  const targetEntities =
    session.options?.targetEntityKeys
      ?.map((key) => entityMap.get(key))
      .filter((entity): entity is SearchableEntityOption => Boolean(entity)) ||
    [targetEntity];

  return {
    sourceEntity,
    targetEntity,
    sourceEntities,
    targetEntities,
  };
}

// GET - Get a single saved reconciliation session
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, sessionId } = await params;

    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const savedSession = await getSavedReconciliationSessionById(
      sessionId,
      orgId,
      session.user.id
    );

    if (!savedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Convert schemaType from DB to full entity objects
    const availableEntities = await getSearchableEntitiesForOrg(orgId);
    const entityMap = new Map<string, SearchableEntityOption>(
      availableEntities.map((entity) => [entity.schemaType, entity])
    );
    const resolvedEntities = resolveSessionEntities(savedSession, entityMap);

    if (!resolvedEntities) {
      return NextResponse.json(
        { error: "Entity not found for saved session" },
        { status: 500 }
      );
    }

    // Destructure to omit key fields and replace with full entity objects
    const { sourceEntityKey, targetEntityKey, ...rest } = savedSession;
    return NextResponse.json({
      ...rest,
      sourceEntity: resolvedEntities.sourceEntity,
      targetEntity: resolvedEntities.targetEntity,
      sourceEntities: resolvedEntities.sourceEntities,
      targetEntities: resolvedEntities.targetEntities,
    });
  } catch (error) {
    console.error("Error getting saved reconciliation session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get reconciliation session",
      },
      { status: 500 }
    );
  }
}

// PATCH - Update a saved reconciliation session
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, sessionId } = await params;

    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateSavedReconciliationSessionBody = await req.json();

    const updatedSession = await updateSavedReconciliationSession({
      id: sessionId,
      orgId,
      userId: session.user.id,
      ...body,
    });

    if (!updatedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Convert schemaType from DB to full entity objects
    const availableEntities = await getSearchableEntitiesForOrg(orgId);
    const entityMap = new Map<string, SearchableEntityOption>(
      availableEntities.map((entity) => [entity.schemaType, entity])
    );
    const resolvedEntities = resolveSessionEntities(updatedSession, entityMap);

    if (!resolvedEntities) {
      return NextResponse.json(
        { error: "Entity not found for saved session" },
        { status: 500 }
      );
    }

    // Destructure to omit key fields and replace with full entity objects
    const { sourceEntityKey, targetEntityKey, ...rest } = updatedSession;
    return NextResponse.json({
      ...rest,
      sourceEntity: resolvedEntities.sourceEntity,
      targetEntity: resolvedEntities.targetEntity,
      sourceEntities: resolvedEntities.sourceEntities,
      targetEntities: resolvedEntities.targetEntities,
    });
  } catch (error) {
    console.error("Error updating saved reconciliation session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update reconciliation session",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a saved reconciliation session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, sessionId } = await params;

    if (!(await userCanAccessOrgId(orgId, session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deleted = await deleteSavedReconciliationSession(
      sessionId,
      orgId,
      session.user.id
    );

    if (!deleted) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved reconciliation session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete reconciliation session",
      },
      { status: 500 }
    );
  }
}
