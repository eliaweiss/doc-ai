import { searchIndexTbl } from "../../../schemas/search";
import { documentDataTbl } from "../../../schemas/documents";
import { eq, and, sql, SQL } from "drizzle-orm";
import { parseSchemaType } from "@zdocs/types";
import type { SearchByEntityMultiQueryOptions } from "@zdocs/types";

/**
 * Apply schema-specific JSONB field filters and track if document_data join is needed
 * Returns whether document_data join is required and the join conditions
 */
export function applySchemaSpecificFilters(
  where: SearchByEntityMultiQueryOptions["where"],
  conditions: SQL[]
): {
  needsDocumentDataJoin: boolean;
  documentDataConditions: SQL[];
} {
  let needsDocumentDataJoin = false;
  const documentDataConditions: SQL[] = [];

  if (!where || where.length === 0) {
    return { needsDocumentDataJoin: false, documentDataConditions: [] };
  }

  needsDocumentDataJoin = true;
  documentDataConditions.push(
    eq(searchIndexTbl.documentId, documentDataTbl.documentId)
  );

  for (const clause of where) {
    const { collectionKey } = parseSchemaType(clause.schemaType);

    if (collectionKey === null) {
      // HEADER entity - access headerData JSONB
      applyHeaderFilter(clause, conditions);
    } else {
      // LINE_ITEM entity - find entities where ANY item matches
      applyLineItemFilter(clause, collectionKey, conditions);
    }
  }

  return { needsDocumentDataJoin, documentDataConditions };
}

/**
 * `(v1, v2, ...)` for an IN clause. drizzle expands an array param into a
 * parenthesized list, so `= ANY(${array})` renders as `= ANY(($1, $2))`,
 * which Postgres rejects.
 */
function inList(values: unknown[]): SQL {
  if (values.length === 0) return sql`(null)`;
  return sql`(${sql.join(
    values.map((v) => sql`${String(v)}`),
    sql`, `
  )})`;
}

/**
 * Apply filter for HEADER entity (headerData JSONB field)
 */
function applyHeaderFilter(
  clause: NonNullable<SearchByEntityMultiQueryOptions["where"]>[0],
  conditions: SQL[]
): void {
  const jsonbPath = sql`${documentDataTbl.headerData}->>${clause.field}`;
  const schemaTypeCondition = eq(searchIndexTbl.schemaType, clause.schemaType);

  switch (clause.op) {
    case "=":
      conditions.push(
        and(schemaTypeCondition, sql`${jsonbPath} = ${clause.value}`)!
      );
      break;
    case "in":
      if (Array.isArray(clause.value)) {
        conditions.push(
          and(schemaTypeCondition, sql`${jsonbPath} in ${inList(clause.value)}`)!
        );
      }
      break;
    case ">=":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`(${jsonbPath})::numeric >= ${clause.value}`
        )!
      );
      break;
    case "<=":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`(${jsonbPath})::numeric <= ${clause.value}`
        )!
      );
      break;
    case ">":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`(${jsonbPath})::numeric > ${clause.value}`
        )!
      );
      break;
    case "<":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`(${jsonbPath})::numeric < ${clause.value}`
        )!
      );
      break;
    case "contains":
      if (typeof clause.value === "string") {
        const escaped = clause.value.replace(/[%_]/g, "\\$&");
        conditions.push(
          and(
            schemaTypeCondition,
            sql`${jsonbPath} ILIKE ${"%" + escaped + "%"}`
          )!
        );
      }
      break;
    default:
      console.warn(
        `Unknown operator "${clause.op}" in where clause for field "${clause.field}" - skipping`
      );
      break;
  }
}

/**
 * Apply filter for LINE_ITEM entity (lineItems JSONB collection)
 * Returns ALL line items from documents where ANY item matches
 */
function applyLineItemFilter(
  clause: NonNullable<SearchByEntityMultiQueryOptions["where"]>[0],
  collectionKey: string,
  conditions: SQL[]
): void {
  const schemaTypeCondition = eq(searchIndexTbl.schemaType, clause.schemaType);
  const lineItemsArray = sql`${documentDataTbl.lineItems}->${collectionKey}`;
  const fieldName = clause.field;

  switch (clause.op) {
    case "=":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${lineItemsArray}) AS elem WHERE elem->>${fieldName} = ${clause.value})`
        )!
      );
      break;
    case "in":
      if (Array.isArray(clause.value)) {
        conditions.push(
          and(
            schemaTypeCondition,
            sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${lineItemsArray}) AS elem WHERE elem->>${fieldName} in ${inList(clause.value)})`
          )!
        );
      }
      break;
    case ">=":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${lineItemsArray}) AS elem WHERE (elem->>${fieldName})::numeric >= ${clause.value})`
        )!
      );
      break;
    case "<=":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${lineItemsArray}) AS elem WHERE (elem->>${fieldName})::numeric <= ${clause.value})`
        )!
      );
      break;
    case ">":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${lineItemsArray}) AS elem WHERE (elem->>${fieldName})::numeric > ${clause.value})`
        )!
      );
      break;
    case "<":
      conditions.push(
        and(
          schemaTypeCondition,
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${lineItemsArray}) AS elem WHERE (elem->>${fieldName})::numeric < ${clause.value})`
        )!
      );
      break;
    case "contains":
      if (typeof clause.value === "string") {
        const escaped = clause.value.replace(/[%_]/g, "\\$&");
        conditions.push(
          and(
            schemaTypeCondition,
            sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${lineItemsArray}) AS elem WHERE elem->>${fieldName} ILIKE ${"%" + escaped + "%"})`
          )!
        );
      }
      break;
    default:
      console.warn(
        `Unknown operator "${clause.op}" in where clause for field "${clause.field}" - skipping`
      );
      break;
  }
}
