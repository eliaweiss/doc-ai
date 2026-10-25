import type {
  EntityResponse,
  FieldDefinition,
  DenormalizedAsType,
  ReconciliationPairRef,
} from "@zdocs/types";
import { formatDate, formatCurrency } from "@zdocs/util";

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatFieldValue(
  value: unknown,
  field: FieldDefinition | undefined,
  rowData: EntityResponse
): string {
  if (value === null || value === undefined) return "";
  if (!field) return String(value);

  switch (field.type) {
    case "currency": {
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(numValue as number)) return "";
      const currencyCode =
        (rowData.data[field.currencyField || "currency"] as string) ||
        rowData.preview.currency ||
        "USD";
      return formatCurrency(numValue as number, currencyCode);
    }
    case "number": {
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (isNaN(num as number)) return "";
      return String(num);
    }
    case "date":
      return formatDate(value as string | Date);
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

const FIXED_COLUMN_DENORMALIZED: DenormalizedAsType[] = [
  "date" as DenormalizedAsType,
  "documentDate" as DenormalizedAsType,
  "description" as DenormalizedAsType,
  "currency" as DenormalizedAsType,
];

function getVisibleFields(
  schema: FieldDefinition[],
  onlyImportant: boolean
): FieldDefinition[] {
  return schema.filter((f) => {
    if (f.name.startsWith("_") || f.name === "id") return false;
    if (f.hidden) return false;
    if (
      f.denormalizedAs &&
      FIXED_COLUMN_DENORMALIZED.includes(f.denormalizedAs)
    ) {
      return false;
    }
    if (f.type === "date" && f.name === "date") return false;
    if (f.isDescription || f.name === "description") return false;
    if (onlyImportant) {
      return f.isImportant || !!f.denormalizedAs;
    }
    return true;
  });
}

interface BuildReconciliationCSVParams {
  sourceResults: EntityResponse[];
  targetResults: EntityResponse[];
  sourceSchema: FieldDefinition[];
  targetSchema: FieldDefinition[];
  pairs: ReconciliationPairRef[];
  onlyReconciled: boolean;
  onlyImportantFields: boolean;
  sourceLabel: string;
  targetLabel: string;
}

export function buildReconciliationCSV({
  sourceResults,
  targetResults,
  sourceSchema,
  targetSchema,
  pairs,
  onlyReconciled,
  onlyImportantFields,
  sourceLabel,
  targetLabel,
}: BuildReconciliationCSVParams): string {
  const sourceFields = getVisibleFields(sourceSchema, onlyImportantFields);
  const targetFields = getVisibleFields(targetSchema, onlyImportantFields);

  const sourceById = new Map<string, EntityResponse>();
  for (const item of sourceResults) {
    sourceById.set(item.ref.entityId, item);
  }
  const targetById = new Map<string, EntityResponse>();
  for (const item of targetResults) {
    targetById.set(item.ref.entityId, item);
  }

  const sourceHeaderPrefix = sourceLabel;
  const targetHeaderPrefix = targetLabel;

  const sourceHeaders = [
    `${sourceHeaderPrefix} - Date`,
    `${sourceHeaderPrefix} - Description`,
    ...sourceFields.map(
      (f) => `${sourceHeaderPrefix} - ${f.displayName || f.name}`
    ),
  ];
  const targetHeaders = [
    `${targetHeaderPrefix} - Date`,
    `${targetHeaderPrefix} - Description`,
    ...targetFields.map(
      (f) => `${targetHeaderPrefix} - ${f.displayName || f.name}`
    ),
  ];
  const headerRow = [...sourceHeaders, ...targetHeaders];

  const rows: string[][] = [headerRow];

  const matchedSourceIds = new Set<string>();
  const matchedTargetIds = new Set<string>();

  for (const pair of pairs) {
    const source = sourceById.get(pair.sourceRef.ref.entityId);
    const target = targetById.get(pair.targetRef.ref.entityId);

    if (onlyReconciled && (!source || !target)) continue;

    const sourceRow = buildSideColumns(source, sourceFields);
    const targetRow = buildSideColumns(target, targetFields);

    rows.push([...sourceRow, ...targetRow]);

    matchedSourceIds.add(pair.sourceRef.ref.entityId);
    matchedTargetIds.add(pair.targetRef.ref.entityId);
  }

  if (!onlyReconciled) {
    const emptySourceCols = new Array(sourceHeaders.length).fill("");
    const emptyTargetCols = new Array(targetHeaders.length).fill("");

    for (const source of sourceResults) {
      if (matchedSourceIds.has(source.ref.entityId)) continue;
      const sourceRow = buildSideColumns(source, sourceFields);
      rows.push([...sourceRow, ...emptyTargetCols]);
    }

    for (const target of targetResults) {
      if (matchedTargetIds.has(target.ref.entityId)) continue;
      const targetRow = buildSideColumns(target, targetFields);
      rows.push([...emptySourceCols, ...targetRow]);
    }
  }

  return rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
}

function buildSideColumns(
  item: EntityResponse | undefined,
  fields: FieldDefinition[]
): string[] {
  if (!item) {
    return new Array(2 + fields.length).fill("");
  }

  const date = item.preview.date || item.ref.date || "";
  const description = item.preview.description || "";

  const fieldValues = fields.map((field) => {
    const value = item.data[field.name];
    return formatFieldValue(value, field, item);
  });

  return [formatDate(date), description, ...fieldValues];
}
