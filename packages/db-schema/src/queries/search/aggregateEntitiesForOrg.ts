import { zdocsDb } from "../../db";
import { searchIndexTbl } from "../../schemas/search";
import { documentDataTbl } from "../../schemas/documents";
import { eq, and, gte, lte, inArray, sql, type SQL } from "drizzle-orm";
import { getSearchableEntitiesForOrg } from "./getSearchableEntitiesForOrg";

// Check if we're running in Edge Runtime
const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

// Allowlisted search_index columns. Anything else must be a field of the
// schema named by params.schemaType, and is read from document_data.
const ALLOWLIST = {
  // Fields that can be used in groupBy
  groupable: [
    "docType",
    "entityType",
    "schemaType",
    "collectionKey",
    "currency",
    "isDataset",
    "isDuplicate",
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
    "isDuplicate",
  ],
} as const;

// Schema field types that hold numbers
const NUMERIC_FIELD_TYPES = ["number", "currency", "sum"];

// Time buckets on the indexed date
const TIME_BUCKETS = ["date", "month", "year"] as const;

// Fields that pick which kind of entity is aggregated; without one of them
// headers and their line items would both be counted.
const ENTITY_SCOPE_FIELDS = ["entityType", "schemaType", "collectionKey", "entityId"];

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
  isDuplicate: searchIndexTbl.isDuplicate,
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
  /**
   * Restrict to one schema type (e.g. "INVOICE_header") and allow its schema
   * fields (e.g. "vendorName") in groupBy, where and sum/avg.
   */
  schemaType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface AggregateEntitiesResult {
  rows: Array<Record<string, unknown>>;
  /** Defaults the query applied that the caller didn't ask for */
  notes?: string[];
}

/**
 * Aggregate entities from search_index table
 * Enforces org isolation and field allowlisting for security
 *
 * Unknown fields throw instead of being skipped, so a caller never gets an
 * unfiltered or ungrouped total that looks like the answer it asked for.
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

  const { metrics, where, schemaType, dateFrom, dateTo, limit } = params;
  const groupBy = [...(params.groupBy ?? [])];
  const notes: string[] = [];

  if (!metrics || metrics.length === 0) {
    throw new Error("aggregate: at least one metric is required");
  }

  // Schema fields of params.schemaType, read from document_data
  const schemaFields = schemaType
    ? await getSchemaFields(orgId, schemaType)
    : null;
  const isHeaderSchema = schemaFields?.isHeader ?? false;

  // The key is inlined as a literal (it's checked against the schema first):
  // a bound parameter in both SELECT and GROUP BY isn't the same expression to Postgres
  const schemaFieldExpr = (field: string): SQL => {
    const key = sql.raw(`'${field.replace(/'/g, "''")}'`);
    if (isHeaderSchema) {
      return sql`(${documentDataTbl.headerData}->>${key})`;
    }
    // Line item entity IDs end in _<index> into lineItems[collectionKey]
    return sql`((${documentDataTbl.lineItems}->${searchIndexTbl.collectionKey})->(substring(${searchIndexTbl.entityId} from '_([0-9]+)$')::int)->>${key})`;
  };
  const numericExpr = (text: SQL): SQL =>
    sql`(case when ${text} ~ '^\\s*-?[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?\\s*$' then (${text})::numeric end)`;

  const unknownField = (field: string, usage: string, allowed: readonly string[]) =>
    new Error(
      `aggregate: "${field}" can't be used in ${usage}. ` +
        `Allowed index fields: ${allowed.join(", ")}.` +
        (schemaFields
          ? ` Fields of ${schemaType}: ${schemaFields.names.join(", ")}.`
          : " To use a schema field (e.g. a vendor name), set schemaType (see list_searchable_entities).")
    );

  // Resolve a field to an expression: index column first, then schema field
  const resolve = (
    field: string,
    usage: string,
    allowed: readonly string[]
  ): { expr: SQL | any; isSchemaField: boolean; isNumeric: boolean } => {
    if (allowed.includes(field) && columnMap[field]) {
      return { expr: columnMap[field], isSchemaField: false, isNumeric: field === "amount" };
    }
    const type = schemaFields?.types[field];
    if (type) {
      return {
        expr: schemaFieldExpr(field),
        isSchemaField: true,
        isNumeric: NUMERIC_FIELD_TYPES.includes(type),
      };
    }
    throw unknownField(field, usage, allowed);
  };

  let needsDocumentDataJoin = false;

  // Build base conditions - always filter by orgId
  const conditions: SQL[] = [eq(searchIndexTbl.orgId, orgId)];

  if (schemaType) {
    conditions.push(eq(searchIndexTbl.schemaType, schemaType));
  }

  // Apply where clauses
  for (const clause of where ?? []) {
    const { expr, isSchemaField, isNumeric } = resolve(
      clause.field,
      "where",
      ALLOWLIST.filterable
    );
    if (isSchemaField) needsDocumentDataJoin = true;
    // Numbers compare as numbers; text (including ISO dates) compares as text
    const ordered = isSchemaField && isNumeric ? numericExpr(expr) : expr;

    switch (clause.op) {
      case "=":
        conditions.push(
          isSchemaField
            ? sql`${expr} = ${String(clause.value)}`
            : eq(expr, clause.value as any)
        );
        break;
      case "in":
        if (!Array.isArray(clause.value)) {
          throw new Error(`aggregate: "in" on "${clause.field}" needs an array value`);
        }
        if (clause.value.length === 0) {
          conditions.push(sql`false`);
        } else if (isSchemaField) {
          // drizzle expands an array param into a list, so build the IN list explicitly
          const values = clause.value.map((v) => sql`${String(v)}`);
          conditions.push(sql`${expr} in (${sql.join(values, sql`, `)})`);
        } else {
          conditions.push(inArray(expr, clause.value));
        }
        break;
      case ">=":
        conditions.push(sql`${ordered} >= ${clause.value}`);
        break;
      case "<=":
        conditions.push(sql`${ordered} <= ${clause.value}`);
        break;
      case ">":
        conditions.push(sql`${ordered} > ${clause.value}`);
        break;
      case "<":
        conditions.push(sql`${ordered} < ${clause.value}`);
        break;
      case "contains":
        if (typeof clause.value !== "string") {
          throw new Error(`aggregate: "contains" on "${clause.field}" needs a string value`);
        }
        conditions.push(
          sql`${expr} ILIKE ${"%" + clause.value.replace(/[%_\\]/g, "\\$&") + "%"}`
        );
        break;
      default:
        throw new Error(`aggregate: unknown operator "${(clause as any).op}"`);
    }
  }

  // Without an entity scope, headers and line items would be counted together
  const scoped =
    !!schemaType ||
    (where ?? []).some((c) => ENTITY_SCOPE_FIELDS.includes(c.field)) ||
    groupBy.some((f) => ENTITY_SCOPE_FIELDS.includes(f));
  if (!scoped) {
    conditions.push(eq(searchIndexTbl.entityType, "HEADER"));
    notes.push(
      "Only document headers were aggregated (entityType = HEADER), so line items aren't counted twice. Set schemaType or filter on entityType to change this."
    );
  }

  // Apply date filters
  if (dateFrom) {
    conditions.push(gte(searchIndexTbl.date, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(searchIndexTbl.date, dateTo));
  }

  // Summing the indexed amount across currencies is meaningless
  const sumsIndexedAmount = metrics.some(
    (m) => (m.op === "sum" || m.op === "avg") && m.field === "amount"
  );
  const singleCurrency = (where ?? []).some(
    (c) => c.field === "currency" && c.op === "="
  );
  if (sumsIndexedAmount && !singleCurrency && !groupBy.includes("currency")) {
    groupBy.push("currency");
    notes.push("Grouped by currency as well, since amounts in different currencies can't be added.");
  }

  // Build select object for metrics
  const selectFields: Record<string, any> = {};
  let firstMetric: SQL | null = null;

  for (const metric of metrics) {
    const alias = metric.as;
    let expr: SQL;

    switch (metric.op) {
      case "count":
        expr = sql<number>`count(*)::int`;
        break;
      case "sum":
      case "avg": {
        if (!metric.field) {
          throw new Error(`aggregate: ${metric.op} metric "${alias}" needs a field`);
        }
        const resolved = resolve(metric.field, `a ${metric.op} metric`, ALLOWLIST.numeric);
        if (!resolved.isNumeric) {
          throw new Error(
            `aggregate: ${metric.op} needs a numeric field; "${metric.field}" is ${schemaFields?.types[metric.field]}`
          );
        }
        if (resolved.isSchemaField) needsDocumentDataJoin = true;
        const value = resolved.isSchemaField
          ? numericExpr(resolved.expr)
          : sql`${resolved.expr}::numeric`;
        expr =
          metric.op === "sum"
            ? sql<number>`coalesce(sum(${value}), 0)::float`
            : sql<number>`avg(${value})::float`;
        break;
      }
      default:
        throw new Error(`aggregate: unknown metric op "${(metric as any).op}"`);
    }

    selectFields[alias] = expr.as(alias);
    firstMetric ??= expr;
  }

  // Build groupBy expressions
  const groupByExprs: any[] = [];
  let timeBucketExpr: any = null;

  for (const field of groupBy) {
    if (field === "date") {
      // Special handling for date - group by the date string
      selectFields["date"] = searchIndexTbl.date;
      groupByExprs.push(searchIndexTbl.date);
      timeBucketExpr = searchIndexTbl.date;
    } else if (field === "month") {
      // Group by month (YYYY-MM)
      const monthExpr = sql`to_char(${searchIndexTbl.date}::date, 'YYYY-MM')`;
      selectFields["month"] = monthExpr.as("month");
      groupByExprs.push(monthExpr);
      timeBucketExpr = monthExpr;
    } else if (field === "year") {
      // Group by year (YYYY)
      const yearExpr = sql`to_char(${searchIndexTbl.date}::date, 'YYYY')`;
      selectFields["year"] = yearExpr.as("year");
      groupByExprs.push(yearExpr);
      timeBucketExpr = yearExpr;
    } else {
      const { expr, isSchemaField } = resolve(field, "groupBy", [
        ...ALLOWLIST.groupable,
        ...TIME_BUCKETS,
      ]);
      if (isSchemaField) needsDocumentDataJoin = true;
      selectFields[field] = isSchemaField ? sql`${expr}`.as(field) : expr;
      groupByExprs.push(expr);
    }
  }

  // Build query
  const base = zdocsDb.select(selectFields).from(searchIndexTbl);
  let query: any = needsDocumentDataJoin
    ? base.innerJoin(
        documentDataTbl,
        eq(searchIndexTbl.documentId, documentDataTbl.documentId)
      )
    : base;
  query = query.where(and(...conditions));

  // Apply groupBy
  if (groupByExprs.length > 0) {
    query = query.groupBy(...groupByExprs);
    // Time series read in order; other groups biggest first, so a limit keeps the top ones
    query = timeBucketExpr
      ? query.orderBy(timeBucketExpr)
      : query.orderBy(sql`${firstMetric} desc nulls last`);
  }

  // Apply limit
  if (limit && limit > 0) {
    query = query.limit(limit);
  }

  const results = await query.execute();

  return {
    rows: results as Array<Record<string, unknown>>,
    ...(notes.length > 0 ? { notes } : {}),
  };
}

async function getSchemaFields(
  orgId: string,
  schemaType: string
): Promise<{ names: string[]; types: Record<string, string>; isHeader: boolean }> {
  const entities = await getSearchableEntitiesForOrg(orgId);
  const entity = entities.find((e) => e.schemaType === schemaType);
  if (!entity) {
    throw new Error(
      `aggregate: unknown schemaType "${schemaType}". Known: ${entities
        .map((e) => e.schemaType)
        .join(", ")}`
    );
  }
  return {
    names: entity.schema.map((f) => f.name),
    types: Object.fromEntries(entity.schema.map((f) => [f.name, f.type])),
    isHeader: entity.entityType === "HEADER",
  };
}
