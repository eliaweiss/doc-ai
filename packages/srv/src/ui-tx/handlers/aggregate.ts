import { aggregateEntitiesForOrg } from "@zdocs/db-schema";
import type { AggregateResponse } from "@zdocs/types";
import type { UiTxContext } from "../handleUiTxRequest";

interface AggregateParams {
  orgId: string; // Required but validated at route level
  from: "documents" | "entities";
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
  schemaType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

/**
 * Aggregation operations for entities
 * Supports count, sum, avg with groupBy and filtering
 */
export async function handleAggregate(
  context: UiTxContext,
  params: AggregateParams
): Promise<AggregateResponse> {
  const { orgId } = context;

  // Currently only "entities" is implemented
  if (params.from !== "entities") {
    // TODO: Implement documents aggregation if needed
    return { rows: [] };
  }

  // Delegate to db-schema aggregation function
  return aggregateEntitiesForOrg(orgId, {
    metrics: params.metrics,
    groupBy: params.groupBy,
    where: params.where,
    schemaType: params.schemaType,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    limit: params.limit,
  });
}
