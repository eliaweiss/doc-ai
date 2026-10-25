import { z, ZodObject, ZodRawShape } from "zod";
import type { FieldDefinition } from "@zdocs/types";
import { getFieldValuePreprocessor } from "./coerceAiFieldValue";

/**
 * Converts a FieldType to JSON Schema type string (for AI prompts)
 */
export function fieldTypeToJsonType(type: string): string {
  switch (type) {
    case "text":
      return "string";
    case "number":
    case "currency":
      return "number";
    case "date":
      return "string (ISO format YYYY-MM-DD)";
    case "boolean":
      return "boolean";
    case "enum":
      return "string (enum)";
    default:
      return "string";
  }
}

/**
 * Converts a FieldDefinition to a Zod schema
 */
export function fieldToZod(field: FieldDefinition): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case "text":
      schema = z.string();
      if (field.maxLength)
        schema = (schema as z.ZodString).max(field.maxLength);
      if (field.pattern)
        schema = (schema as z.ZodString).regex(new RegExp(field.pattern));
      break;

    case "number":
    case "currency":
      schema = z.number();
      if (field.min !== undefined)
        schema = (schema as z.ZodNumber).min(field.min);
      if (field.max !== undefined)
        schema = (schema as z.ZodNumber).max(field.max);
      break;

    case "date":
      // ISO date string
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
      break;

    case "boolean":
      schema = z.boolean();
      break;

    case "enum":
      if (field.enumValues && field.enumValues.length > 0) {
        schema = z.enum(field.enumValues as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;

    default:
      schema = z.unknown();
  }

  // All fields are nullable by default (AI extraction may fail to extract).
  // Preprocess generically so AI placeholder strings ("null", "N/A", numbers
  // as strings, etc.) are coerced before validation regardless of schema.
  return z.preprocess(getFieldValuePreprocessor(field), schema.nullable());
}

/**
 * Builds a Zod object schema from field definitions
 */
export function buildZodSchema(fields: FieldDefinition[]): ZodObject<ZodRawShape> {
  const shape: ZodRawShape = {};

  for (const field of fields) {
    shape[field.name] = fieldToZod(field);
  }

  return z.object(shape);
}
