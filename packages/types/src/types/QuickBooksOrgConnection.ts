/**
 * Doc type name prefix produced by the `QB_ACCOUNT` data-source driver.
 * Each QB account gets its own doc type: `QB_ACCOUNT_TRANSACTIONS_{ACCOUNT}`.
 * Documents whose docType starts with this prefix are bank/credit/expense
 * transactions that already live in QuickBooks; they cannot be pushed back to QB.
 */
export const QB_ACCOUNT_DOC_TYPE_PREFIX = "QB_ACCOUNT_TRANSACTIONS";

export const QB_ENTITY_TYPES = [
  "Invoice",
  "Bill",
  "Purchase",
  "BillPayment",
] as const;
export type QbEntityType = (typeof QB_ENTITY_TYPES)[number];

/** Reusable QuickBooks name+value reference (Account, Customer, Vendor, Item). */
export interface QbRef {
  name: string;
  value: string;
}

/**
 * Persisted QuickBooks Online OAuth connection for an organization (server-side row shape).
 */
export interface QuickBooksOrgConnection {
  id: string;
  orgId: string;
  realmId: string;
  companyName: string | null;
  purchaseMapping: QuickBooksPurchaseMapping | null;
  refreshTokenEncrypted: string;
  accessTokenEncrypted: string;
  accessTokenExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Saved mapping choices for pushing documents as QuickBooks Purchases.
 * Persisted at org-level so new pushes reuse previous choices.
 */
export interface QuickBooksPurchaseMapping {
  paymentType: "Cash" | "Check" | "CreditCard";
  paymentAccountRef: QbRef | null;
  expenseAccountRef: QbRef | null;
}

export interface QbInvoiceMapping {
  customerRef: QbRef;
  itemRef: QbRef;
  taxCodeRef?: QbRef | null;
  dueDate?: string | null;
}

export interface QbBillMapping {
  vendorRef: QbRef;
  expenseAccountRef: QbRef;
  dueDate?: string | null;
}

export interface QbBillPaymentMapping {
  billId: string;
  payType: "Check" | "CreditCard";
  bankAccountRef: QbRef;
  vendorRef: QbRef;
}

export type QuickBooksPushBody =
  | { entityType: "Invoice"; mapping: QbInvoiceMapping }
  | { entityType: "Bill"; mapping: QbBillMapping }
  | { entityType: "Purchase"; mapping: QuickBooksPurchaseMapping }
  | { entityType: "BillPayment"; mapping: QbBillPaymentMapping };
