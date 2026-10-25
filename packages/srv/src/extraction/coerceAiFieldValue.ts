import type { FieldDefinition } from "@zdocs/types";

/**
 * Generic coercion for AI-extracted field values.
 *
 * LLMs frequently emit placeholder strings instead of real `null` (e.g. the
 * literal string "null", "undefined", "N/A", "-"), and emit numbers/booleans as
 * strings ("3,516.65", "true"). These break strict Zod validation even though
 * every field is nullable. This module normalizes those values BEFORE validation
 * in a schema-agnostic way, driven only by the field's declared type.
 */

// Always treated as "no value" placeholders, even for free-text fields.
const STRICT_NULL_LIKE = new Set(["null", "undefined", ""]);

// Additional placeholders treated as null for non-text types (date/number/etc),
// where these are never legitimate content.
const EXTENDED_NULL_LIKE = new Set([
  ...STRICT_NULL_LIKE,
  "n/a",
  "na",
  "none",
  "nil",
  "-",
  "—",
]);

function isNullLike(value: string, extended: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  return (extended ? EXTENDED_NULL_LIKE : STRICT_NULL_LIKE).has(normalized);
}

/**
 * Converts AI placeholder strings to real `null`. For non-string input the
 * value is returned untouched. `extended` enables a broader placeholder set for
 * field types where those tokens can never be valid content.
 */
function normalizeNullLike(value: unknown, extended: boolean): unknown {
  if (typeof value !== "string") return value;
  if (isNullLike(value, extended)) return null;
  return value.trim();
}

function coerceNumber(value: unknown): unknown {
  const normalized = normalizeNullLike(value, true);
  if (typeof normalized !== "string") return normalized;
  // Strip currency symbols, thousands separators and spaces; keep digits, sign, decimal point.
  const cleaned = normalized.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? value : parsed;
}

function coerceBoolean(value: unknown): unknown {
  const normalized = normalizeNullLike(value, true);
  if (typeof normalized !== "string") return normalized;
  const lower = normalized.toLowerCase();
  if (["true", "yes", "1"].includes(lower)) return true;
  if (["false", "no", "0"].includes(lower)) return false;
  return value;
}

/**
 * Returns the appropriate preprocessor for a field's declared type. Used with
 * `z.preprocess(...)` so coercion runs before validation for every field.
 */
export function getFieldValuePreprocessor(
  field: FieldDefinition
): (value: unknown) => unknown {
  switch (field.type) {
    case "number":
    case "currency":
      return coerceNumber;
    case "boolean":
      return coerceBoolean;
    case "date":
    case "enum":
      return (value) => normalizeNullLike(value, true);
    default:
      // text and unknown: only strip clear placeholders, never legitimate content.
      return (value) => normalizeNullLike(value, false);
  }
}
