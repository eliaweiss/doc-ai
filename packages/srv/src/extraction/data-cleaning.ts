/**
 * Converts string "null" values to actual null.
 * AI models sometimes return the string "null" instead of JSON null.
 */
export function cleanNullStrings(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === "null" ? null : value;
  }
  return result;
}

/**
 * Cleans null strings from all line item collections.
 */
export function cleanLineItemsNullStrings(
  lineItems: Record<string, Record<string, unknown>[]>
): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const [collectionKey, items] of Object.entries(lineItems)) {
    result[collectionKey] = items.map(cleanNullStrings);
  }
  return result;
}
