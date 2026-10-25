import type { EntityResponse, FieldDefinition } from "@zdocs/types";

/**
 * Two items are considered duplicates when they share the same date and amount.
 * The schema parameter is kept for API compatibility but is not used.
 */
export function isZdocsDuplicate(
  zdocs1: EntityResponse,
  zdocs2: EntityResponse,
  _schema: FieldDefinition[]
) {
  if (zdocs1.preview?.date !== zdocs2.preview?.date) return false;

  const a1 = zdocs1.preview?.amount;
  const a2 = zdocs2.preview?.amount;
  if (a1 == null || a2 == null) return false;
  if (Math.abs(a1 - a2) >= 0.1) return false;

  return true;
}
