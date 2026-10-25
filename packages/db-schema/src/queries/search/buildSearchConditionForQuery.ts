import { searchIndexTbl } from "../../schemas/search";
import { sql, or } from "drizzle-orm";

/**
 * Build search condition for a single query term
 * @param query - The search query string
 * @param exactMatch - When true, only use ILIKE for exact substring matching
 * @returns SQL condition or null if query is empty
 */
export function buildSearchConditionForQuery(
  query: string,
  exactMatch: boolean
): ReturnType<typeof sql> | ReturnType<typeof or> | null {
  // Remove surrounding quotes (AI may send '""' or "''" as empty query)
  let trimmedQuery = query.trim();

  // Strip outer quotes if the query is just quotes or quoted empty string
  if (/^["']+$/.test(trimmedQuery) || /^["'][\s]*["']$/.test(trimmedQuery)) {
    return null;
  }

  // Remove surrounding quotes from the query (e.g., '"hello"' -> 'hello')
  trimmedQuery = trimmedQuery.replace(/^["']+|["']+$/g, "").trim();

  if (!trimmedQuery) return null;

  if (exactMatch) {
    // Exact match: only ILIKE substring matching
    return sql`${searchIndexTbl.content} ILIKE ${"%" + trimmedQuery + "%"}`;
  }

  // Fuzzy matching: full-text search + word similarity + ILIKE
  return or(
    // Full-text search: handles stemming (e.g., "searching" matches "search")
    sql`to_tsvector('english', ${searchIndexTbl.content}) @@ websearch_to_tsquery('english', ${trimmedQuery})`,
    // Word similarity: handles typos by finding query as substring within content
    // Uses word_similarity() which is better for short query vs long text (threshold 0.3)
    sql`word_similarity(${trimmedQuery}, ${searchIndexTbl.content}) > 0.3`,
    // ILIKE: handles substring/partial word matching (uses GIN trigram index)
    sql`${searchIndexTbl.content} ILIKE ${"%" + trimmedQuery + "%"}`
  );
}
