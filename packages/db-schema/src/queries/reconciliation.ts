import { eq, and, sql, desc, or, inArray } from "drizzle-orm";
import { extractRows, zdocsDb } from "../db";
import {
  reconciliationLinksTbl,
  savedReconciliationSessionsTbl,
  savedLedgerTraceSessionsTbl,
} from "../schemas/reconciliation-links";
import type {
  ReconciliationPairObj,
  ReconciliationLinkFilters,
  SearchableEntityOption,
  LedgerTraceSessionOptions,
  SavedLedgerTraceSession,
  TraceRequest,
  TraceResponse,
  MoneyFlowChain,
  MoneyFlowLink,
  ReconciliationPairRef,
  ReconciliationObjRef,
  CreateReconciliationLinkInput,
  ReconciliationSessionOptions,
} from "@zdocs/types";

/**
 * Create a new reconciliation link
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param input - Link creation data
 * @param userId - Optional user ID who created the link
 */
export async function createReconciliationLink(
  orgId: string,
  input: CreateReconciliationLinkInput,
  userId?: string
): Promise<ReconciliationPairObj> {
  const [link] = await zdocsDb
    .insert(reconciliationLinksTbl)
    .values({
      orgId,
      sourceRef: input.sourceRef,
      targetRef: input.targetRef,
      date: input.date,
      amount: Number(input.amount),
      currency: input.currency,
      type: input.type || "manual",
      confidence: input.confidence ?? 1.0,
      metadata: input.metadata || null,
      createdBy: userId || null,
    })
    .returning();

  return link as ReconciliationPairObj;
}

/**
 * Get all links for an organization with optional filtering
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param filters - Optional filters to apply
 */
export async function getReconciliationLinksForOrg(
  orgId: string,
  filters?: ReconciliationLinkFilters
): Promise<ReconciliationPairObj[]> {

  const conditions = [
    eq(reconciliationLinksTbl.orgId, orgId),
    sql`${reconciliationLinksTbl.deletedAt} IS NULL`,
  ];

  // Apply filters if provided
  if (filters?.type) {
    conditions.push(eq(reconciliationLinksTbl.type, filters.type));
  }
  if (filters?.currency) {
    conditions.push(eq(reconciliationLinksTbl.currency, filters.currency));
  }

  const links = await zdocsDb
    .select({
      link: reconciliationLinksTbl,

    })
    .from(reconciliationLinksTbl)
    .where(and(...conditions))
    .orderBy(desc(reconciliationLinksTbl.date));
  // console.log(links);

  return links.map((link) => ({
    ...link.link,
  })) as ReconciliationPairObj[];
}

/**
 * Get all links connected to a specific entity (bidirectional)
 * Returns both incoming and outgoing links
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param entityId - The entity ID to find links for
 */
export async function getLinksForEntity(
  orgId: string,
  entityId: string
): Promise<ReconciliationPairObj[]> {
  const links = await zdocsDb
    .select({
      id: reconciliationLinksTbl.id,
      orgId: reconciliationLinksTbl.orgId,
      sourceRef: reconciliationLinksTbl.sourceRef,
      targetRef: reconciliationLinksTbl.targetRef,
      date: reconciliationLinksTbl.date,
      amount: reconciliationLinksTbl.amount,
      currency: reconciliationLinksTbl.currency,
      type: reconciliationLinksTbl.type,
      edgeType: reconciliationLinksTbl.edgeType,
      confidence: reconciliationLinksTbl.confidence,
      metadata: reconciliationLinksTbl.metadata,
      createdBy: reconciliationLinksTbl.createdBy,
      deletedAt: reconciliationLinksTbl.deletedAt,
      createdAt: reconciliationLinksTbl.createdAt,
      updatedAt: reconciliationLinksTbl.updatedAt,
    })
    .from(reconciliationLinksTbl)
    .where(
      and(
        eq(reconciliationLinksTbl.orgId, orgId),
        sql`${reconciliationLinksTbl.deletedAt} IS NULL`,
        or(
          sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'entityId' = ${entityId}`,
          sql`${reconciliationLinksTbl.targetRef}->'ref'->>'entityId' = ${entityId}`
        )
      )
    );

  return links as ReconciliationPairObj[];
}

/**
 * Delete a reconciliation link (soft delete)
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param linkId - The link ID to delete
 */
export async function deleteReconciliationLink(
  orgId: string,
  linkId: string
): Promise<void> {
  await zdocsDb
    .update(reconciliationLinksTbl)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(reconciliationLinksTbl.id, linkId),
        eq(reconciliationLinksTbl.orgId, orgId)
      )
    );
}

/**
 * Delete a reconciliation link by source and target entity IDs (soft delete)
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param sourceEntityId - The source entity ID
 * @param targetEntityId - The target entity ID
 */
export async function deleteReconciliationLinkByRefs(
  orgId: string,
  sourceEntityId: string,
  targetEntityId: string
): Promise<boolean> {
  const result = await zdocsDb
    .update(reconciliationLinksTbl)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(reconciliationLinksTbl.orgId, orgId),
        sql`${reconciliationLinksTbl.deletedAt} IS NULL`,
        sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'entityId' = ${sourceEntityId}`,
        sql`${reconciliationLinksTbl.targetRef}->'ref'->>'entityId' = ${targetEntityId}`
      )
    )
    .returning({ id: reconciliationLinksTbl.id });

  return result.length > 0;
}

/**
 * Trace money flow through reconciliation links
 * @param orgId - Organization ID
 * @param params - Trace parameters
 */
export async function traceMoneyFlow(
  orgId: string,
  params: TraceRequest
): Promise<TraceResponse> {
  const maxDepth = params.maxDepth || 10;
  const limit = params.limit || 50;

  const hasStart =
    (params.startEntityIds && params.startEntityIds.length > 0) ||
    (params.startSchemaTypes && params.startSchemaTypes.length > 0);
  const hasEnd = params.endEntityIds && params.endEntityIds.length > 0;

  const effectiveEntityIds = hasStart
    ? params.startEntityIds
    : params.endEntityIds;

  const startSchemaTypesArray =
    params.startSchemaTypes && params.startSchemaTypes.length > 0
      ? `{${params.startSchemaTypes.join(",")}}`
      : null;
  const effectiveEntityIdsArray =
    effectiveEntityIds && effectiveEntityIds.length > 0
      ? `{${effectiveEntityIds.join(",")}}`
      : null;

  const endEntityIdsSet = hasEnd
    ? new Set(params.endEntityIds)
    : null;

  const query = sql`
    WITH RECURSIVE 
    starting_links AS (
      SELECT rl.id 
      FROM ${reconciliationLinksTbl} rl
      WHERE rl.org_id = ${orgId}
        AND rl.deleted_at IS NULL
        ${startSchemaTypesArray
      ? sql`AND rl.source_ref->'ref'->>'schemaType' = ANY(${startSchemaTypesArray}::text[])`
      : sql``}
        ${effectiveEntityIdsArray
      ? sql`AND (rl.source_ref->'ref'->>'entityId' = ANY(${effectiveEntityIdsArray}::text[])
                    OR rl.target_ref->'ref'->>'entityId' = ANY(${effectiveEntityIdsArray}::text[]))`
      : sql``}
        ${params.dateFrom ? sql`AND rl.date >= ${params.dateFrom}` : sql``}
        ${params.dateTo ? sql`AND rl.date <= ${params.dateTo}` : sql``}
      ORDER BY rl.date DESC
      LIMIT ${limit}
    ),
    money_flow AS (
      SELECT 
        rl.id,
        rl.org_id,
        rl.source_ref,
        rl.target_ref,
        rl.amount,
        rl.currency,
        rl.edge_type,
        rl.date,
        rl.date as start_date,
        ARRAY[rl.id]::text[] as path,
        0 as depth,
        rl.source_ref->'ref'->>'entityId' as start_entity_id
      FROM ${reconciliationLinksTbl} rl
      INNER JOIN starting_links sl ON rl.id = sl.id
      UNION ALL
      SELECT 
        rl.id,
        rl.org_id,
        rl.source_ref,
        rl.target_ref,
        rl.amount,
        rl.currency,
        rl.edge_type,
        rl.date,
        mf.start_date,
        mf.path || rl.id,
        mf.depth + 1,
        mf.start_entity_id
        
      FROM ${reconciliationLinksTbl} rl
      INNER JOIN money_flow mf ON (
        (mf.target_ref->'ref'->>'entityId' = rl.source_ref->'ref'->>'entityId'
         AND mf.target_ref->'ref'->>'documentId' = rl.source_ref->'ref'->>'documentId')
        OR
        (mf.source_ref->'ref'->>'entityId' = rl.target_ref->'ref'->>'entityId'
         AND mf.source_ref->'ref'->>'documentId' = rl.target_ref->'ref'->>'documentId')
      )
      WHERE rl.deleted_at IS NULL
        AND rl.org_id = ${orgId}
        AND NOT (rl.id = ANY(mf.path))
        AND mf.depth < ${maxDepth}
    )
    SELECT *
    FROM money_flow
    ORDER BY start_date DESC, start_entity_id, depth
    LIMIT 200;
  `;

  const results = await zdocsDb.execute(query);
  const rows = extractRows(results);

  const chainsMap = new Map<string, MoneyFlowLink[]>();
  let maxDepthReached = 0;

  for (const row of rows) {
    const startId = row.start_entity_id as string;
    const depth = row.depth as number;
    maxDepthReached = Math.max(maxDepthReached, depth);

    const link: MoneyFlowLink = {
      id: row.id as string,
      depth: depth,
      sourceRef: row.source_ref as ReconciliationObjRef,
      targetRef: row.target_ref as ReconciliationObjRef,
      amount: row.amount as number, // doc-ai: extractRows rows are typed unknown here
      currency: row.currency as string,
      edgeType: row.edge_type as string,
      path: row.path as string[],
      date: row.date as string,
    };

    if (!chainsMap.has(startId)) {
      chainsMap.set(startId, []);
    }
    chainsMap.get(startId)!.push(link);
  }

  let matchingPaths = 0;
  const chains: MoneyFlowChain[] = [];
  for (const [startId, links] of chainsMap.entries()) {
    const endsAtTarget = endEntityIdsSet
      ? links.some(
          (l) =>
            endEntityIdsSet.has(
              (l.sourceRef as ReconciliationObjRef).ref.entityId
            ) ||
            endEntityIdsSet.has(
              (l.targetRef as ReconciliationObjRef).ref.entityId
            )
        )
      : false;

    if (endsAtTarget) {
      matchingPaths++;
    }

    chains.push({
      startEntityId: startId,
      links,
      endsAtTarget,
      totalDepth: Math.max(...links.map((l) => l.depth)),
    });
  }

  return {
    chains,
    summary: {
      totalPaths: chains.length,
      matchingPaths,
      maxDepthReached,
      truncated: rows.length >= 200,
    },
  };
}

/**
 * Check if an entity has any reconciliation links
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param entityId - The entity ID to check
 */
export async function hasReconciliationLinks(
  orgId: string,
  entityId: string
): Promise<boolean> {
  const links = await getLinksForEntity(orgId, entityId);
  return links.length > 0;
}

/**
 * Check which of the given entity IDs are reconciled with the target entity type
 * @param orgId - Organization ID
 * @param entityIds - List of entity IDs to check
 * @param targetEntityKey - The schemaType of the target entity (e.g. "INVOICE_header", "BANK_STATEMENT_transactions")
 */
export async function getReconciled_IdsToType(
  orgId: string,
  entityIds: string[],
  targetEntityKey: string
): Promise<ReconciliationPairRef[]> {
  if (entityIds.length === 0 || !targetEntityKey) {
    return [];
  }

  const links = await zdocsDb
    .select({
      sourceRef: reconciliationLinksTbl.sourceRef,
      targetRef: reconciliationLinksTbl.targetRef,
      amount: reconciliationLinksTbl.amount,
      currency: reconciliationLinksTbl.currency,
      date: reconciliationLinksTbl.date,
    })
    .from(reconciliationLinksTbl)
    .where(
      and(
        eq(reconciliationLinksTbl.orgId, orgId),
        sql`${reconciliationLinksTbl.deletedAt} IS NULL`,
        inArray(
          sql<string>`${reconciliationLinksTbl.sourceRef}->'ref'->>'entityId'`,
          entityIds
        ),
        sql`${reconciliationLinksTbl.targetRef}->'ref'->>'schemaType' = ${targetEntityKey}`
      )
    );

  // return Array.from(new Set(links.map((l) => l.sourceId)));
  return links;
}

export async function getReconciled_TypeToIds(
  orgId: string,
  entityIds: string[],
  targetEntityKey: string
): Promise<ReconciliationPairRef[]> {
  if (entityIds.length === 0 || !targetEntityKey) {
    return [];
  }

  const links = await zdocsDb
    .select({
      amount: reconciliationLinksTbl.amount,
      currency: reconciliationLinksTbl.currency,
      date: reconciliationLinksTbl.date,
      sourceRef: reconciliationLinksTbl.sourceRef,
      targetRef: reconciliationLinksTbl.targetRef,
    })
    .from(reconciliationLinksTbl)
    .where(
      and(
        eq(reconciliationLinksTbl.orgId, orgId),
        sql`${reconciliationLinksTbl.deletedAt} IS NULL`,
        inArray(
          sql<string>`${reconciliationLinksTbl.targetRef}->'ref'->>'entityId'`,
          entityIds
        ),
        sql`${reconciliationLinksTbl.sourceRef}->'ref'->>'schemaType' = ${targetEntityKey}`
      )
    );

  return links as ReconciliationPairRef[];
}
// ═══════════════════════════════════════════════════════════════════════════════
// SAVED RECONCILIATION SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateSavedReconciliationSessionParams {
  orgId: string;
  userId: string;
  name: string;
  description?: string | null;
  sourceEntity: SearchableEntityOption;
  sourceQuery: string;
  sourceDateFrom?: string | null;
  sourceDateTo?: string | null;
  sourceSelection?: ReconciliationObjRef[];
  targetEntity: SearchableEntityOption;
  targetQuery: string;
  targetDateFrom?: string | null;
  targetDateTo?: string | null;
  targetSelection?: ReconciliationObjRef[];
  amount?: string | null;
  currency?: string | null;
  options?: ReconciliationSessionOptions | null;
}

export interface UpdateSavedReconciliationSessionParams {
  id: string;
  orgId: string;
  userId: string;
  name?: string;
  description?: string | null;
  sourceEntity?: SearchableEntityOption;
  sourceQuery?: string;
  sourceDateFrom?: string | null;
  sourceDateTo?: string | null;
  sourceSelection?: ReconciliationObjRef[];
  targetEntity?: SearchableEntityOption;
  targetQuery?: string;
  targetDateFrom?: string | null;
  targetDateTo?: string | null;
  targetSelection?: ReconciliationObjRef[];
  amount?: string | null;
  currency?: string | null;
  options?: ReconciliationSessionOptions | null;
}

/**
 * Create a new saved reconciliation session
 * @param params - Session data
 */
export async function createSavedReconciliationSession(
  params: CreateSavedReconciliationSessionParams
) {
  const [result] = await zdocsDb
    .insert(savedReconciliationSessionsTbl)
    .values({
      orgId: params.orgId,
      userId: params.userId,
      name: params.name,
      description: params.description || null,
      sourceEntityKey: params.sourceEntity.schemaType,
      sourceQuery: params.sourceQuery,
      sourceDateFrom: params.sourceDateFrom || null,
      sourceDateTo: params.sourceDateTo || null,
      sourceSelection: params.sourceSelection || [],
      targetEntityKey: params.targetEntity.schemaType,
      targetQuery: params.targetQuery,
      targetDateFrom: params.targetDateFrom || null,
      targetDateTo: params.targetDateTo || null,
      targetSelection: params.targetSelection || [],
      amount: params.amount || null,
      currency: params.currency || null,
      options: params.options || null,
    })
    .returning();

  // Return DB result with full entity objects from params
  return {
    ...result,
    sourceEntity: params.sourceEntity,
    targetEntity: params.targetEntity,
  };
}

/**
 * List all saved reconciliation sessions for a user in an org
 * @param orgId - Organization ID
 * @param userId - User ID
 */
export async function listSavedReconciliationSessions(
  orgId: string,
  userId: string
) {
  return zdocsDb
    .select()
    .from(savedReconciliationSessionsTbl)
    .where(
      and(
        eq(savedReconciliationSessionsTbl.orgId, orgId),
        eq(savedReconciliationSessionsTbl.userId, userId)
      )
    )
    .orderBy(desc(savedReconciliationSessionsTbl.createdAt));
}

/**
 * Get a single saved reconciliation session by ID
 * @param id - Session ID
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param userId - User ID (for access control)
 */
export async function getSavedReconciliationSessionById(
  id: string,
  orgId: string,
  userId: string
) {
  const [result] = await zdocsDb
    .select()
    .from(savedReconciliationSessionsTbl)
    .where(
      and(
        eq(savedReconciliationSessionsTbl.id, id),
        eq(savedReconciliationSessionsTbl.orgId, orgId),
        eq(savedReconciliationSessionsTbl.userId, userId)
      )
    )
    .limit(1);

  return result ?? null;
}

/**
 * Update a saved reconciliation session
 * @param params - Update parameters
 */
export async function updateSavedReconciliationSession(
  params: UpdateSavedReconciliationSessionParams
) {
  const { id, orgId, userId, ...updates } = params;

  const updateData: Partial<
    typeof savedReconciliationSessionsTbl.$inferInsert
  > = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.sourceEntity !== undefined)
    updateData.sourceEntityKey = updates.sourceEntity.schemaType;
  if (updates.sourceQuery !== undefined)
    updateData.sourceQuery = updates.sourceQuery;
  if (updates.sourceDateFrom !== undefined)
    updateData.sourceDateFrom = updates.sourceDateFrom;
  if (updates.sourceDateTo !== undefined)
    updateData.sourceDateTo = updates.sourceDateTo;
  if (updates.sourceSelection !== undefined)
    updateData.sourceSelection = updates.sourceSelection;
  if (updates.targetEntity !== undefined)
    updateData.targetEntityKey = updates.targetEntity.schemaType;
  if (updates.targetQuery !== undefined)
    updateData.targetQuery = updates.targetQuery;
  if (updates.targetDateFrom !== undefined)
    updateData.targetDateFrom = updates.targetDateFrom;
  if (updates.targetDateTo !== undefined)
    updateData.targetDateTo = updates.targetDateTo;
  if (updates.targetSelection !== undefined)
    updateData.targetSelection = updates.targetSelection;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.currency !== undefined) updateData.currency = updates.currency;
  if (updates.options !== undefined) updateData.options = updates.options;

  updateData.updatedAt = new Date();

  const [result] = await zdocsDb
    .update(savedReconciliationSessionsTbl)
    .set(updateData)
    .where(
      and(
        eq(savedReconciliationSessionsTbl.id, id),
        eq(savedReconciliationSessionsTbl.orgId, orgId),
        eq(savedReconciliationSessionsTbl.userId, userId)
      )
    )
    .returning();

  return result ?? null;
}

/**
 * Delete a saved reconciliation session
 * @param id - Session ID
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param userId - User ID (for access control)
 */
export async function deleteSavedReconciliationSession(
  id: string,
  orgId: string,
  userId: string
): Promise<boolean> {
  const result = await zdocsDb
    .delete(savedReconciliationSessionsTbl)
    .where(
      and(
        eq(savedReconciliationSessionsTbl.id, id),
        eq(savedReconciliationSessionsTbl.orgId, orgId),
        eq(savedReconciliationSessionsTbl.userId, userId)
      )
    )
    .returning({ id: savedReconciliationSessionsTbl.id });

  return result.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAVED LEDGER TRACE SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateSavedLedgerTraceSessionParams {
  orgId: string;
  userId: string;
  name: string;
  description?: string | null;
  options: LedgerTraceSessionOptions;
}

export interface UpdateSavedLedgerTraceSessionParams {
  id: string;
  orgId: string;
  userId: string;
  name?: string;
  description?: string | null;
  options?: LedgerTraceSessionOptions;
}

/**
 * Create a new saved ledger trace session
 * @param params - Session data
 */
export async function createSavedLedgerTraceSession(
  params: CreateSavedLedgerTraceSessionParams
): Promise<SavedLedgerTraceSession> {
  const [result] = await zdocsDb
    .insert(savedLedgerTraceSessionsTbl)
    .values({
      orgId: params.orgId,
      userId: params.userId,
      name: params.name,
      description: params.description || null,
      options: params.options,
    })
    .returning();

  return result as SavedLedgerTraceSession;
}

/**
 * List all saved ledger trace sessions for a user in an org
 * @param orgId - Organization ID
 * @param userId - User ID
 */
export async function listSavedLedgerTraceSessions(
  orgId: string,
  userId: string
): Promise<SavedLedgerTraceSession[]> {
  const results = await zdocsDb
    .select()
    .from(savedLedgerTraceSessionsTbl)
    .where(
      and(
        eq(savedLedgerTraceSessionsTbl.orgId, orgId),
        eq(savedLedgerTraceSessionsTbl.userId, userId)
      )
    )
    .orderBy(desc(savedLedgerTraceSessionsTbl.createdAt));

  return results as SavedLedgerTraceSession[];
}

/**
 * Get a single saved ledger trace session by ID
 * @param id - Session ID
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param userId - User ID (for access control)
 */
export async function getSavedLedgerTraceSessionById(
  id: string,
  orgId: string,
  userId: string
): Promise<SavedLedgerTraceSession | null> {
  const [result] = await zdocsDb
    .select()
    .from(savedLedgerTraceSessionsTbl)
    .where(
      and(
        eq(savedLedgerTraceSessionsTbl.id, id),
        eq(savedLedgerTraceSessionsTbl.orgId, orgId),
        eq(savedLedgerTraceSessionsTbl.userId, userId)
      )
    )
    .limit(1);

  return (result as SavedLedgerTraceSession) ?? null;
}

/**
 * Update a saved ledger trace session
 * @param params - Update parameters
 */
export async function updateSavedLedgerTraceSession(
  params: UpdateSavedLedgerTraceSessionParams
): Promise<SavedLedgerTraceSession | null> {
  const { id, orgId, userId, ...updates } = params;

  const updateData: Partial<typeof savedLedgerTraceSessionsTbl.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.options !== undefined) updateData.options = updates.options;

  const [result] = await zdocsDb
    .update(savedLedgerTraceSessionsTbl)
    .set(updateData)
    .where(
      and(
        eq(savedLedgerTraceSessionsTbl.id, id),
        eq(savedLedgerTraceSessionsTbl.orgId, orgId),
        eq(savedLedgerTraceSessionsTbl.userId, userId)
      )
    )
    .returning();

  return (result as SavedLedgerTraceSession) ?? null;
}

/**
 * Delete a saved ledger trace session
 * @param id - Session ID
 * @param orgId - Organization ID (for multi-tenant isolation)
 * @param userId - User ID (for access control)
 */
export async function deleteSavedLedgerTraceSession(
  id: string,
  orgId: string,
  userId: string
): Promise<boolean> {
  const result = await zdocsDb
    .delete(savedLedgerTraceSessionsTbl)
    .where(
      and(
        eq(savedLedgerTraceSessionsTbl.id, id),
        eq(savedLedgerTraceSessionsTbl.orgId, orgId),
        eq(savedLedgerTraceSessionsTbl.userId, userId)
      )
    )
    .returning({ id: savedLedgerTraceSessionsTbl.id });

  return result.length > 0;
}
