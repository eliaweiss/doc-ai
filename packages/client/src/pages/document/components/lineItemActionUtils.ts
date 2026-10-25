import { FieldDefinition } from "@zdocs/types";

export type LineItemFormData = Record<string, unknown>;

export function getEditableLineItemFields(
  lineItemSchema: FieldDefinition[]
): FieldDefinition[] {
  return lineItemSchema.filter(
    (field) => !field.hidden && field.type !== "sum" && field.type !== "code"
  );
}

export function getDefaultLineItemValue(field: FieldDefinition): unknown {
  if (field.type === "boolean") {
    return false;
  }

  return null;
}

export function buildEmptyLineItem(
  lineItemSchema: FieldDefinition[]
): LineItemFormData {
  const lineItem: LineItemFormData = {
    id: crypto.randomUUID(),
  };

  for (const field of getEditableLineItemFields(lineItemSchema)) {
    lineItem[field.name] = getDefaultLineItemValue(field);
  }

  return lineItem;
}

export function convertLineItemFieldValue(
  field: FieldDefinition,
  value: string | boolean
): unknown {
  if (typeof value === "boolean") {
    return value;
  }

  switch (field.type) {
    case "number":
    case "currency":
      if (value === "") {
        return null;
      }
      const parsedValue = Number.parseFloat(value);
      return Number.isNaN(parsedValue) ? null : parsedValue;
    case "date":
      return value || null;
    default:
      return value || null;
  }
}

export function getLineItemFieldInputType(
  field: FieldDefinition
): "text" | "number" | "date" {
  switch (field.type) {
    case "number":
    case "currency":
      return "number";
    case "date":
      return "date";
    default:
      return "text";
  }
}

export function getLineItemFieldStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
