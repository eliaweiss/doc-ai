import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/app/session-auth/auth-config";
import { getServerSession } from "next-auth/next";
import {
  createSavedReconciliationSession,
  listSavedReconciliationSessions,
  getSearchableEntitiesForOrg,
} from "@zdocs/db-schema";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import type {
  SavedReconciliationSession,
  SearchableEntityOption,
  ReconciliationSessionOptions,
} from "@zdocs/types";

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

// POST - Create a new saved reconciliation session
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

    const body = await req.json();
    const {
      name,
      description,
      sourceEntity,
      sourceQuery,
      sourceDateFrom,
      sourceDateTo,
      sourceSelection,
      targetEntity,
      targetQuery,
      targetDateFrom,
      targetDateTo,
      targetSelection,
      amount,
      currency,
      options,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Session name is required" },
        { status: 400 }
      );
    }

    if (!sourceEntity || !sourceEntity.schemaType) {
      return NextResponse.json(
        { error: "Source entity is required" },
        { status: 400 }
      );
    }

    if (!targetEntity || !targetEntity.schemaType) {
      return NextResponse.json(
        { error: "Target entity is required" },
        { status: 400 }
      );
    }

    const savedSession = await createSavedReconciliationSession({
      orgId,
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim(),
      sourceEntity,
      sourceQuery: sourceQuery?.trim() || "",
      sourceDateFrom,
      sourceDateTo,
      targetEntity,
      targetQuery: targetQuery?.trim() || "",
      targetDateFrom,
      targetDateTo,
      amount: amount?.trim(),
      currency: currency?.trim(),
      options,
    });
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

    return NextResponse.json({
      ...savedSession,
      sourceEntity: resolvedEntities.sourceEntity,
      targetEntity: resolvedEntities.targetEntity,
      sourceEntities: resolvedEntities.sourceEntities,
      targetEntities: resolvedEntities.targetEntities,
    });
  } catch (error) {
    console.error("Error creating saved reconciliation session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save reconciliation session",
      },
      { status: 500 }
    );
  }
}

// GET - List all saved reconciliation sessions for the current user
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

    const sessions = await listSavedReconciliationSessions(
      orgId,
      session.user.id
    );

    // Convert schemaType from DB to full entity objects
    const availableEntities = await getSearchableEntitiesForOrg(orgId);
    const entityMap = new Map<string, SearchableEntityOption>(
      availableEntities.map((entity) => [entity.schemaType, entity])
    );

    const sessionsWithEntities: SavedReconciliationSession[] = [];
    for (const session of sessions) {
      const resolvedEntities = resolveSessionEntities(session, entityMap);
      if (!resolvedEntities) {
        // Skip sessions with missing entities
        continue;
      }

      // Destructure to omit key fields and replace with full entity objects
      const { sourceEntityKey, targetEntityKey, ...rest } = session;
      sessionsWithEntities.push({
        ...rest,
        sourceEntity: resolvedEntities.sourceEntity,
        targetEntity: resolvedEntities.targetEntity,
        sourceEntities: resolvedEntities.sourceEntities,
        targetEntities: resolvedEntities.targetEntities,
      });
    }

    return NextResponse.json({ sessions: sessionsWithEntities });
  } catch (error) {
    console.error("Error listing saved reconciliation sessions:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list reconciliation sessions",
      },
      { status: 500 }
    );
  }
}
