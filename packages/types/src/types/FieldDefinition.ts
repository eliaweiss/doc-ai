// ═══════════════════════════════════════════════════════════════════════════════
// FIELD DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

import { InstitutionType } from "./Institution";

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const BASE_FIELD_TYPES = [
  "text", // Free-form text
  "number", // Numeric value
  "currency", // Monetary amount (number with currency context)
  "date", // ISO date string (YYYY-MM-DD)
  "boolean", // true/false
  "enum", // Predefined set of values
] as const;
export type BaseFieldType = (typeof BASE_FIELD_TYPES)[number];

export const DERIVED_FIELD_TYPES = [
  "sum", // sum of a group of fields
  "code", // code field (js code field )
] as const;
export type DerivedFieldType = (typeof DERIVED_FIELD_TYPES)[number];
export type FieldType = BaseFieldType | DerivedFieldType;

// ═══════════════════════════════════════════════════════════════════════════════
// DENORMALIZED VALUES
// ═══════════════════════════════════════════════════════════════════════════════
export enum DenormalizedAsType {
  AMOUNT = "amount",
  TOTAL_AMOUNT = "totalAmount",
  DATE = "date",
  DOCUMENT_DATE = "documentDate",
  DUE_DATE = "dueDate",
  CURRENCY = "currency",
  DESCRIPTION = "description",
}

export interface DenormalizedValues {
  amount: number | null;
  date: string | null;
  dueDate: string | null;
  currency: string | null;
  description: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULA TYPES (for computed/derived fields)
// ═══════════════════════════════════════════════════════════════════════════════

// Base interface for all formula types
export interface FormulaBase {
  fieldType: BaseFieldType; // Output type of the formula
  datasets?: string[]; // Dataset type names to load for formula execution
}

// Sum formula - aggregates a numeric column from line items
export interface FormulaSum extends FormulaBase {
  fieldPath: string; // Single path to field to aggregate, e.g., 'items.amount'
  fieldType: "number" | "currency";
  currencyFieldPath?: string; // For currency: path to currency code field
  // e.g., 'header.currency' or 'items.currency'
}

// Code formula - user-defined JavaScript
export interface FormulaCode extends FormulaBase {
  inputFields: string[]; // Paths to input fields (for UI testing), can be empty
  code: string; // JavaScript function body
}

// Union type
export type FormulaType = FormulaSum | FormulaCode;

/**
 * Defines a single field in a document schema (header or line item)
 */
export interface FieldDefinition {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Field key in JSONB: "invoiceNumber", "total" */
  name: string;

  /** Data type */
  type: FieldType;

  /** UI label: "Invoice Number", "Total Amount" */
  displayName: string;

  formula?: FormulaType;

  hidden?: boolean; // default: false

  /**
   * If true, this field is part of the primary key for upsert operations.
   * For datasets, the first field is automatically marked as primary key.
   * Multiple fields can be marked to form a composite key.
   * Used in Phase 2 for Append/Upsert import methods.
   */
  isPrimaryKey?: boolean;

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Must be present (for validation, not DB constraint) */
  required?: boolean;

  /** For 'enum' type - allowed values: ["PAID", "UNPAID", "OVERDUE"] */
  enumValues?: string[];

  /** For 'number' / 'currency' type - minimum value */
  min?: number;

  /** For 'number' / 'currency' type - maximum value */
  max?: number;

  /** For 'text' type - maximum string length */
  maxLength?: number;

  /** For 'text' type - regex pattern */
  pattern?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // AI EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * If false, this field is NOT sent to AI for extraction (set by system)
   * Example: pageNumber is set by the system based on document pages, not AI
   * Default: true (field is AI extractable)
   */
  aiExtractable?: boolean;

  /** For AI prompt: "The unique invoice identifier" */
  description?: string;

  /** Extra context for AI: "Usually found in top-right corner" */
  extractionHint?: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH & DISPLAY
  // ═══════════════════════════════════════════════════════════════════════════

  /** Include in search_index content */
  searchable?: boolean;

  /** For 'currency' type - which field contains the currency code */
  currencyField?: string;

  /** Display formatting: "date:MMM DD, YYYY", "currency:2", "number:0" */
  format?: string;

  /** Whether this field is important - ie need to appear in any view */
  isImportant?: boolean;

  /** Whether this field is a description - ie a free-form text field */
  isDescription?: boolean;

  width?: number;
  minWidth?: number;
  flex?: number;
  pinned?: "left" | "right" | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH & DISPLAY
  // ═══════════════════════════════════════════════════════════════════════════

  /** show in reconciliation view */
  isReconcilable?: boolean; // default: false

  // ═══════════════════════════════════════════════════════════════════════════
  // DENORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** If set, this field's value is copied to document_data column for fast filtering */
  denormalizedAs?: DenormalizedAsType;

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTITUTION REFERENCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * If true, this field contains an institution name that should be resolved to institutionId.
   * During extraction:
   * 1. AI extracts the institution NAME
   * 2. System fuzzy-matches against existing institutions (orgId-scoped)
   * 3. Only the institutionId is stored in JSONB (not the name)
   * 4. Name is looked up from institutions table when displaying
   */
  isInstitution?: boolean;

  /**
   * For institution fields - the type of institution (helps with categorization)
   * Only used when isInstitution: true
   */
  institutionType?: InstitutionType;

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAPH / VISUALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Determines which axis this field can be used on when plotting graphs.
   * - "both": Can be used on X or Y axis
   * - "x": Only for X axis (typically categorical/date fields)
   * - "y": Only for Y axis (typically numeric fields)
   * - "none": Cannot be used in graphs
   * Default: inferred from field type (date/text -> x, number/currency -> y)
   */
  axis?: "both" | "x" | "y" | "none";
}



/**
 * Get denormalized field values from extracted header data.
 * Maps fields with denormalizedAs to their target columns.
 */
export function getDenormalizedValues(
  data: Record<string, unknown>,
  schema: FieldDefinition[]
): DenormalizedValues {
  const result: DenormalizedValues = {
    amount: null as number | null,
    date: null as string | null,
    dueDate: null as string | null,
    currency: null as string | null,
    description: null as string | null,
  };

  for (const field of schema) {
    if (!field.denormalizedAs) continue;

    const value = data[field.name];
    if (value === null || value === undefined) continue;

    switch (field.denormalizedAs) {
      case DenormalizedAsType.AMOUNT:
      case DenormalizedAsType.TOTAL_AMOUNT:
        result.amount =
          typeof value === "number" ? value : parseFloat(String(value));
        break;
      case DenormalizedAsType.DATE:
      case DenormalizedAsType.DOCUMENT_DATE:
        result.date = typeof value === "string" ? value : null;
        break;
      case DenormalizedAsType.DUE_DATE:
        result.dueDate = typeof value === "string" ? value : null;
        break;
      case DenormalizedAsType.CURRENCY:
        result.currency = typeof value === "string" ? value : null;
        break;
      case DenormalizedAsType.DESCRIPTION:
        result.description = typeof value === "string" ? value : null;
        break;
    }
  }

  return result;
}
