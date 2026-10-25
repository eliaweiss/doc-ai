import type {
  DocumentTypeRecord,
  FieldDefinition,
  LineItemCollectionSchema,
} from "@zdocs/types";

export interface PortableSchema {
  name: string;
  displayName?: string;
  description?: string;
  extractionHint?: string;
  templateName?: string;
  headerSchema: FieldDefinition[];
  lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
  isDataset?: boolean;
  isSystem?: boolean;
  icon?: string;
  color?: string;
}

export function toPortableSchema(schema: DocumentTypeRecord): PortableSchema {
  return {
    name: schema.name,
    displayName: schema.displayName ?? undefined,
    description: schema.description ?? undefined,
    extractionHint: schema.extractionHint ?? undefined,
    templateName: schema.templateName ?? undefined,
    headerSchema: schema.headerSchema,
    lineItemSchemas: schema.lineItemSchemas ?? undefined,
    isDataset: schema.isDataset ?? undefined,
    isSystem: schema.isSystem ?? undefined,
    icon: schema.icon ?? undefined,
    color: schema.color ?? undefined,
  };
}

export function downloadPortableSchema(schema: DocumentTypeRecord): void {
  const blob = new Blob([JSON.stringify(toPortableSchema(schema), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `schema-${schema.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parsePortableSchema(data: unknown): PortableSchema {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid schema file");
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.headerSchema)) {
    throw new Error("Invalid schema file");
  }

  const lineItemSchemas = parseLineItemSchemas(obj.lineItemSchemas);

  return {
    name: typeof obj.name === "string" ? obj.name : "",
    displayName:
      typeof obj.displayName === "string" ? obj.displayName : undefined,
    description:
      typeof obj.description === "string" ? obj.description : undefined,
    extractionHint:
      typeof obj.extractionHint === "string" ? obj.extractionHint : undefined,
    templateName:
      typeof obj.templateName === "string" ? obj.templateName : undefined,
    headerSchema: obj.headerSchema as FieldDefinition[],
    lineItemSchemas,
    isDataset: typeof obj.isDataset === "boolean" ? obj.isDataset : undefined,
    isSystem: typeof obj.isSystem === "boolean" ? obj.isSystem : undefined,
    icon: typeof obj.icon === "string" ? obj.icon : undefined,
    color: typeof obj.color === "string" ? obj.color : undefined,
  };
}

function parseLineItemSchemas(
  value: unknown
): Record<string, LineItemCollectionSchema> | null | undefined {
  if (value == null) {
    return value === null ? null : undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid schema file");
  }
  return value as Record<string, LineItemCollectionSchema>;
}
