import type { EntityObj } from "./Entity";

/**
 * Link types
 */
export const RECONCILIATION_LINK_TYPES = ["manual", "suggested"] as const;
export type ReconciliationLinkType = (typeof RECONCILIATION_LINK_TYPES)[number];

/**
 * Sign symbol for reconciliation
 * `-` means the amount is negative (expense)
 * `+` means the amount is positive (income)
 */
export type SignSymbol = "+" | "-";

/**
 * Use this to define the tolerance for a reconciliation pair
 * dayDrift: the number of days the date can differ
 * sign: the sign of the amount
 * amountDrift: the amount can differ by this amount
 */
export type ToleranceReconcilePair = {
  dayDrift: number;
  sign: SignSymbol;
  amountDrift: number | null; // not used yet
};
/**
 * a mapping of source field name to target field name to tolerance
 * eg, {
 *   "amount": {
 *     "transactionAmount": {
 *       dayDrift: 2,
 *       sign: "+",
 *       amountDrift: 0.01
 *     }
 *   }
 * }
 */
export type ToleranceReconcileMapping = Record<
  string,
  Record<string, ToleranceReconcilePair>
>;

/**
 * a reference to a reconciliation pair
 * field.name and field.value are the source field name and value
 * field.description is the description of the entity that was used for the reconciliation
 */
export interface ReconciliationObjRef {
  ref: EntityObj;
  field: {
    name: string | null;
    value: number | null;
    description: string;
  };
}

/**
 * Fully defined a reconciliation pair
 * sourceRef and targetRef are the source and target entities
 * amount is the amount of the reconciliation
 * currency is the currency of the reconciliation
 * date is the date of the reconciliation (sourceRef.ref.date)
 */
export interface ReconciliationPairRef {
  sourceRef: ReconciliationObjRef;
  targetRef: ReconciliationObjRef;
  amount: number;
  currency: string;
  date: string;
}

/**
 * A reconciliation pair with tolerance
 * used by the client UI to suggest new reconciliation pairs
 * The algo will scan past reconciled and keep the max day drift/amount drift/sign difference
 * and will apply these values to the new reconciliation pair below the drift threshold
 */
export const RECONCILIATION_MATCH_METHODS = [
  "rule",
  "exactDate",
] as const;
export type ReconciliationMatchMethod =
  (typeof RECONCILIATION_MATCH_METHODS)[number];

export interface ReconciliationPairWithTolerance extends ReconciliationPairRef {
  sign?: SignSymbol;
  signChoiceMade: boolean;
  dayDrift?: number; // Actual day difference between source and target dates
  amountDiff?: number;
  matchMethod?: ReconciliationMatchMethod;
  matchRule?: ToleranceReconcilePair;
  needManualCheck: {
    reason: string;
    metadata?: Record<string, unknown> | null;
  }[];
}



/**
 * A link between two financial entities
 * extends ReconciliationPairRef to point to a obj in the db
 */
export interface ReconciliationPairObj extends ReconciliationPairRef {
  id: string;
  orgId: string;
  type: ReconciliationLinkType;

  // Use reconciliation as “financial truth graph”
  edgeType?: string | null; //paid_by, converted_via, deposited_to, relates_to, duplicates, split_across, partial_payment_of
  confidence: number; // 0.0-1.0
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}



/**
 * Filters for querying links
 */
export interface ReconciliationLinkFilters {
  sourceDocType?: string;
  targetDocType?: string;
  type?: "manual" | "suggested";
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

