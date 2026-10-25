import { or } from "drizzle-orm";
import { buildSearchConditionForQuery } from "./buildSearchConditionForQuery";

/**
 * Build combined search condition for multiple queries (ORed together)
 * @param queries - Array of search query strings
 * @param exactMatch - When true, only use ILIKE for exact substring matching
 * @returns SQL condition or null if all queries are empty
 */
export function buildMultiQuerySearchCondition(
  queries: string[],
  exactMatch: boolean
): ReturnType<typeof or> | null {
  const conditions = queries
    .map((q) => buildSearchConditionForQuery(q, exactMatch))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0] as ReturnType<typeof or>;

  return or(...conditions);
}

