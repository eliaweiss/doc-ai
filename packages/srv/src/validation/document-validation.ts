import { z, ZodObject, ZodRawShape } from "zod";
import {
  type FieldDefinition,
  type LineItemCollectionSchema,
} from "@zdocs/types";
import { getFieldValuePreprocessor } from "../extraction/coerceAiFieldValue";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZOD SCHEMA BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Converts a FieldDefinition to a Zod schema
 */
function fieldToZod(field: FieldDefinition): z.ZodTypeAny {
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

  // All fields are nullable by default (AI extraction may fail).
  // Preprocess generically so AI placeholder strings ("null", "N/A", numbers
  // as strings, etc.) are coerced before validation regardless of schema.
  const finalSchema = field.required ? schema : schema.nullable();
  return z.preprocess(getFieldValuePreprocessor(field), finalSchema);
}

/**
 * Builds a Zod object schema from field definitions
 */
export function buildZodSchema(
  fields: FieldDefinition[]
): ZodObject<ZodRawShape> {
  const shape: ZodRawShape = {};

  for (const field of fields) {
    shape[field.name] = fieldToZod(field);
  }

  return z.object(shape);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates document data against its type schema
 * Supports named line item collections
 */
export function validateDocumentData(
  headerData: unknown,
  lineItems: Record<string, Record<string, unknown>[]> | null,
  schema: {
    headerSchema: FieldDefinition[];
    lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
  }
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate header
  const headerZodSchema = buildZodSchema(schema.headerSchema);
  const headerResult = headerZodSchema.safeParse(headerData);

  if (!headerResult.success) {
    for (const error of headerResult.error.errors) {
      errors.push({
        path: `header.${error.path.join(".")}`,
        message: error.message,
      });
    }
  }

  // Validate line item collections
  if (lineItems && schema.lineItemSchemas) {
    for (const [zdocsTypeKey, collectionSchema] of Object.entries(
      schema.lineItemSchemas
    )) {
      const collectionData = lineItems[zdocsTypeKey];

      if (collectionData) {
        const collectionZodSchema = z.array(
          buildZodSchema(collectionSchema.fields)
        );
        const collectionResult = collectionZodSchema.safeParse(collectionData);

        if (!collectionResult.success) {
          for (const error of collectionResult.error.errors) {
            errors.push({
              path: `lineItems.${zdocsTypeKey}.${error.path.join(".")}`,
              message: error.message,
            });
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a single header data object against its schema
 */
export function validateHeaderData(
  headerData: unknown,
  headerSchema: FieldDefinition[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const zodSchema = buildZodSchema(headerSchema);
  const result = zodSchema.safeParse(headerData);

  if (!result.success) {
    for (const error of result.error.errors) {
      errors.push({
        path: error.path.join("."),
        message: error.message,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a single line item against its schema
 */
export function validateLineItem(
  lineItem: unknown,
  lineItemSchema: FieldDefinition[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const zodSchema = buildZodSchema(lineItemSchema);
  const result = zodSchema.safeParse(lineItem);

  if (!result.success) {
    for (const error of result.error.errors) {
      errors.push({
        path: error.path.join("."),
        message: error.message,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
