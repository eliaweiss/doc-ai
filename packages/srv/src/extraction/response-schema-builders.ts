import { z, ZodObject, ZodRawShape } from "zod";
import type { LineItemCollectionSchema } from "@zdocs/types";
import { getAiExtractableFields } from "@zdocs/types";
import { buildZodSchema } from "./zod-schema-builder";
import { AdditionalCategoryPrompt } from "./category-mapping-service";

function toNonEmptyEnum(
  values: string[]
): [string, ...string[]] | null {
  if (values.length === 0) {
    return null;
  }
  return [values[0], ...values.slice(1)];
}

/**
 * Builds response schema for header-only extraction (multi-page path)
 */
export function buildHeaderResponseSchema(
  headerZodSchema: ZodObject<ZodRawShape>,
  hasFolderMappings: boolean,
  folderEnum: [string, ...string[]]
): z.ZodType<{
  header: Record<string, unknown>;
  selectedFolder?: string | null;
}> {
  if (hasFolderMappings) {
    return z.object({
      header: headerZodSchema,
      selectedFolder: z.enum(folderEnum).nullable(),
    });
  } else {
    return z.object({
      header: headerZodSchema,
    }) as z.ZodType<{
      header: Record<string, unknown>;
      selectedFolder?: string | null;
    }>;
  }
}

/**
 * Builds response schema for line-items-only extraction (multi-page path)
 */
export function buildLineItemsResponseSchema(
  lineItemSchemas: Record<string, LineItemCollectionSchema>,
  additionalCategoryPrompt: AdditionalCategoryPrompt
): z.ZodType<{
  lineItems: Record<string, Record<string, unknown>[]> | null;
}> {
  const categoryEnumValues = toNonEmptyEnum(
    additionalCategoryPrompt.enumCategoryValues
  );
  const collectionsShape: Record<
    string,
    z.ZodArray<ZodObject<ZodRawShape>>
  > = {};
  for (const [zdocsTypeKey, collection] of Object.entries(lineItemSchemas)) {
    const aiFields = getAiExtractableFields(collection.fields);
    let lineItemSchema = buildZodSchema(aiFields);

    if (categoryEnumValues) {
      const enumFieldShape: ZodRawShape = {};
      enumFieldShape["category"] = z
        .enum(categoryEnumValues)
        .nullable()
        .catch(null);
      lineItemSchema = lineItemSchema.extend(enumFieldShape);
    }

    collectionsShape[zdocsTypeKey] = z.array(lineItemSchema);
  }

  return z.object({
    lineItems: z.object(collectionsShape).nullable(),
  });
}

/**
 * Builds full response schema for single-pass extraction (existing path)
 */
export function buildFullResponseSchema(
  headerZodSchema: ZodObject<ZodRawShape>,
  lineItemSchemas: Record<string, LineItemCollectionSchema> | null | undefined,
  hasFolderMappings: boolean,
  folderEnum: [string, ...string[]],
  additionalCategoryPrompt: AdditionalCategoryPrompt
): z.ZodType<{
  header: Record<string, unknown>;
  lineItems: unknown;
  selectedFolder?: string | null;
}> {
  const categoryEnumValues = toNonEmptyEnum(
    additionalCategoryPrompt.enumCategoryValues
  );

  if (!lineItemSchemas || Object.keys(lineItemSchemas).length === 0) {
    // No line items
    if (hasFolderMappings) {
      return z.object({
        header: headerZodSchema,
        lineItems: z.null(),
        selectedFolder: z.enum(folderEnum).nullable(),
      });
    } else {
      return z.object({
        header: headerZodSchema,
        lineItems: z.null(),
      }) as z.ZodType<{
        header: Record<string, unknown>;
        lineItems: unknown;
        selectedFolder?: string | null;
      }>;
    }
  } else {
    // Named collections
    const collectionsShape: Record<
      string,
      z.ZodArray<ZodObject<ZodRawShape>>
    > = {};
    for (const [zdocsTypeKey, collection] of Object.entries(lineItemSchemas)) {
      const aiFields = getAiExtractableFields(collection.fields);
      let lineItemSchema = buildZodSchema(aiFields);

      if (categoryEnumValues) {
        const enumFieldShape: ZodRawShape = {};
        enumFieldShape["category"] = z
          .enum(categoryEnumValues)
          .nullable()
          .catch(null);
        lineItemSchema = lineItemSchema.extend(enumFieldShape);
      }
      collectionsShape[zdocsTypeKey] = z.array(lineItemSchema);
    }
    if (hasFolderMappings) {
      return z.object({
        header: headerZodSchema,
        lineItems: z.object(collectionsShape).nullable(),
        selectedFolder: z.enum(folderEnum).nullable(),
      });
    } else {
      return z.object({
        header: headerZodSchema,
        lineItems: z.object(collectionsShape).nullable(),
      }) as z.ZodType<{
        header: Record<string, unknown>;
        lineItems: unknown;
        selectedFolder?: string | null;
      }>;
    }
  }
}
