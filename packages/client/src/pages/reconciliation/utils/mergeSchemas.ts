import type { FieldDefinition } from "@zdocs/types";

/**
 * Merges multiple entity schemas into a single unified schema.
 * Fields are deduplicated by `name` — first occurrence wins.
 * This ensures denormalized fields (amount, date, currency, description)
 * appear only once, while type-specific fields appear as extra columns
 * (cells will be empty for rows of other entity types).
 */
export function mergeSchemas(schemas: FieldDefinition[][]): FieldDefinition[] {
  const seen = new Set<string>();
  const merged: FieldDefinition[] = [];

  for (const schema of schemas) {
    for (const field of schema) {
      if (!seen.has(field.name)) {
        seen.add(field.name);
        merged.push(field);
      }
    }
  }

  return merged;
}
