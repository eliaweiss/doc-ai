import { searchIndexTbl } from "../../../schemas/search";
import { gte, lte, inArray, SQL } from "drizzle-orm";
import type { SearchByEntityMultiQueryOptions } from "@zdocs/types";

/**
 * Apply preview data filters (date, amount, currency) to search conditions
 * These filters operate on indexed preview fields in the search_index table
 */
export function applyPreviewFilters(
  filters: SearchByEntityMultiQueryOptions["filters"],
  conditions: SQL[]
): void {
  if (!filters?.preview) {
    return;
  }

  // Filter by amount range
  if (filters.preview.amount) {
    if (filters.preview.amount.gte !== undefined) {
      conditions.push(gte(searchIndexTbl.amount, filters.preview.amount.gte));
    }
    if (filters.preview.amount.lte !== undefined) {
      conditions.push(lte(searchIndexTbl.amount, filters.preview.amount.lte));
    }
  }

  // Filter by currency
  if (filters.preview.currency) {
    const currencies = Array.isArray(filters.preview.currency)
      ? filters.preview.currency
      : [filters.preview.currency];
    if (currencies.length > 0) {
      conditions.push(inArray(searchIndexTbl.currency, currencies));
    }
  }
}
