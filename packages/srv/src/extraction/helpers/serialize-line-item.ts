/**
 * Fields that identify a line item for cross-page/chunk dedup.
 * AI-assigned fields such as category are excluded so the same row
 * extracted twice with different categories still collapses to one item.
 *
 * NOTE: `chargeDate` is deliberately NOT an identity key. For credit-card
 * statements the same row extracted via the safety-overlap path often comes
 * back with `chargeDate` set to the billing date instead of the purchase
 * date (while `purchaseDate`, `merchantName` and `chargeAmount` stay
 * stable) - including it here prevented overlap duplicates from collapsing
 * (observed: 31 duplicate groups / 177 rows in one 5-page statement).
 */
const IDENTITY_KEYS = [
  "date",
  "purchaseDate",
  "description",
  "merchantName",
  "debit",
  "credit",
  "chargeAmount",
  "amount",
] as const;

const VOLATILE_KEYS = new Set(["category", "extracted_category", "notes"]);

/** Empty vs 0 on the unused side of a bank credit/debit pair is the same fact. */
const ZERO_EQUIV_KEYS = new Set(["debit", "credit"]);

function normalizeValue(key: string, val: unknown): unknown {
  if (val === null || val === undefined || val === "") return "";
  if (ZERO_EQUIV_KEYS.has(key) && val === 0) return "";
  return val;
}

/**
 * Serializes a line item for equality checks.
 * Prefers stable identity fields when present; otherwise uses all keys
 * except volatile AI fields. Null/undefined/"" normalize to "".
 */
export function serializeLineItem(item: Record<string, unknown>): string {
  const identityKeys = IDENTITY_KEYS.filter((key) => key in item).sort();
  const keys =
    identityKeys.length > 0
      ? identityKeys
      : Object.keys(item)
          .filter((key) => !VOLATILE_KEYS.has(key))
          .sort();

  const normalized: Record<string, unknown> = {};
  for (const key of keys) {
    normalized[key] = normalizeValue(key, item[key]);
  }
  return JSON.stringify(normalized, keys);
}
