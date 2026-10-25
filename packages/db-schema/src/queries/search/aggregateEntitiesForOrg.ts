import { zdocsDb } from "../../db";
import { searchIndexTbl } from "../../schemas/search";
import { eq, and, gte, lte, inArray, sql, like } from "drizzle-orm";

// Check if we're running in Edge Runtime
const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

// Allowlisted fields for security
const ALLOWLIST = {
  // Fields that can be used in groupBy
  groupable: [
    "docType",
    "entityType",
    "schemaType",
    "collectionKey",
    "currency",
    "isDataset",
  ],
  // Fields that can be used in metrics (sum/avg)
  numeric: ["amount"],
  // Fields that can be used in where clauses
  filterable: [
    "entityId",
    "documentId",
    "entityType",
    "docType",
    "schemaType",
    "collectionKey",
    "date",
    "amount",
    "currency",
    "description",
    "isDataset",
  ],
} as const;

// Column map for type-safe access
const columnMap: Record<string, any> = {
  entityId: searchIndexTbl.entityId,
  documentId: searchIndexTbl.documentId,
  entityType: searchIndexTbl.entityType,
  docType: searchIndexTbl.docType,
  schemaType: searchIndexTbl.schemaType,
  collectionKey: searchIndexTbl.collectionKey,
  date: searchIndexTbl.date,
  amount: searchIndexTbl.amount,
  currency: searchIndexTbl.currency,
  description: searchIndexTbl.description,
  isDataset: searchIndexTbl.isDataset,
};

export interface AggregateEntitiesParams {
  metrics: Array<{
    op: "count" | "sum" | "avg";
    field?: string;
    as: string;
  }>;
  groupBy?: string[];
  where?: Array<{
    field: string;
    op: "=" | "in" | ">" | ">=" | "<" | "<=" | "contains";
    value: unknown;
  }>;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface AggregateEntitiesResult {
  rows: Array<Record<string, unknown>>;
}

/**
 * Aggregate entities from search_index table
 * Enforces org isolation and field allowlisting for security
 *
 * @param orgId - Organization ID (required for multi-tenant isolation)
 * @param params - Aggregation parameters
 * @returns Aggregated results
 */
export async function aggregateEntitiesForOrg(
  orgId: string,
  params: AggregateEntitiesParams
): Promise<AggregateEntitiesResult> {
  if (isEdgeRuntime) {
    return { rows: [] };
  }

  const { metrics, groupBy, where, dateFrom, dateTo, limit } = params;

  // Build base conditions - always filter by orgId
  const conditions = [eq(searchIndexTbl.orgId, orgId)];

  // Apply where clauses
  if (where) {
    for (const clause of where) {
      // Validate field is allowlisted
      if (!ALLOWLIST.filterable.includes(clause.field as any)) {
        continue; // Skip non-allowlisted fields for security
      }

      const column = columnMap[clause.field];
      if (!column) continue;

      switch (clause.op) {
        case "=":
          conditions.push(eq(column, clause.value as any));
          break;
        case "in":
          if (Array.isArray(clause.value)) {
            conditions.push(inArray(column, clause.value));
          }
          break;
        case ">=":
          conditions.push(gte(column, clause.value as any));
          break;
        case "<=":
          conditions.push(lte(column, clause.value as any));
          break;
        case ">":
          conditions.push(sql`${column} > ${clause.value}`);
          break;
        case "<":
          conditions.push(sql`${column} < ${clause.value}`);
          break;
        case "contains":
          if (typeof clause.value === "string") {
            conditions.push(like(column, `%${clause.value}%`));
          }
          break;
      }
    }
  }

  // Apply date filters
  if (dateFrom) {
    conditions.push(gte(searchIndexTbl.date, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(searchIndexTbl.date, dateTo));
  }

  // Build select object for metrics
  const selectFields: Record<string, any> = {};

  for (const metric of metrics) {
    const alias = metric.as;

    switch (metric.op) {
      case "count":
        selectFields[alias] = sql<number>`count(*)::int`.as(alias);
        break;
      case "sum":
        if (metric.field && ALLOWLIST.numeric.includes(metric.field as any)) {
          const column = columnMap[metric.field];
          selectFields[alias] =
            sql<number>`coalesce(sum(${column}::numeric), 0)::float`.as(alias);
        }
        break;
      case "avg":
        if (metric.field && ALLOWLIST.numeric.includes(metric.field as any)) {
          const column = columnMap[metric.field];
          selectFields[alias] =
            sql<number>`avg(${column}::numeric)::float`.as(alias);
        }
        break;
    }
  }

  // Build groupBy expressions
  const groupByExprs: any[] = [];
  const groupByColumns: any[] = [];

  if (groupBy && groupBy.length > 0) {
    for (const field of groupBy) {
      if (ALLOWLIST.groupable.includes(field as any)) {
        const column = columnMap[field];
        if (column) {
          // Add to select
          selectFields[field] = column;
          // Add to groupBy list
          groupByColumns.push(column);
          groupByExprs.push(column);
        }
      } else if (field === "date") {
        // Special handling for date - group by the date string
        selectFields["date"] = searchIndexTbl.date;
        groupByColumns.push(searchIndexTbl.date);
        groupByExprs.push(searchIndexTbl.date);
      } else if (field === "month") {
        // Group by month (YYYY-MM)
        const monthExpr = sql`to_char(${searchIndexTbl.date}::date, 'YYYY-MM')`;
        selectFields["month"] = monthExpr.as("month");
        groupByExprs.push(monthExpr);
      } else if (field === "year") {
        // Group by year (YYYY)
        const yearExpr = sql`to_char(${searchIndexTbl.date}::date, 'YYYY')`;
        selectFields["year"] = yearExpr.as("year");
        groupByExprs.push(yearExpr);
      }
    }
  }

  // Build query
  let query = zdocsDb
    .select(selectFields)
    .from(searchIndexTbl)
    .where(and(...conditions));

  // Apply groupBy
  if (groupByExprs.length > 0) {
    query = query.groupBy(...groupByExprs) as any;
  }

  // Apply limit
  if (limit && limit > 0) {
    query = query.limit(limit) as any;
  }

  const results = await query.execute();

  return {
    rows: results as Array<Record<string, unknown>>,
  };
}
