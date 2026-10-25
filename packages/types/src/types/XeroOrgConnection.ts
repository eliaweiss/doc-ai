/**
 * Doc type name prefix produced by the `XERO_ACCOUNT` data-source driver.
 * Each Xero account gets its own doc type: `XERO_ACCOUNT_TRANSACTIONS_{ACCOUNT}`.
 * Documents whose docType starts with this prefix are bank transactions that
 * already live in the connected accounting system; they should not be pushed back.
 */
export const XERO_ACCOUNT_DOC_TYPE_PREFIX = "XERO_ACCOUNT_TRANSACTIONS";

export const XERO_ENTITY_TYPES = ["Invoice", "Bill"] as const;
export type XeroEntityType = (typeof XERO_ENTITY_TYPES)[number];

/** Reusable Xero name+value reference (Contact, Account, Tax Rate). */
export interface XeroRef {
  name: string;
  value: string;
}

export interface XeroInvoiceMapping {
  contactRef: XeroRef;
  accountRef: XeroRef;
  taxTypeRef?: XeroRef | null;
  dueDate?: string | null;
}

export interface XeroBillMapping {
  contactRef: XeroRef;
  expenseAccountRef: XeroRef;
  taxTypeRef?: XeroRef | null;
  dueDate?: string | null;
}

export type XeroPushBody =
  | { entityType: "Invoice"; mapping: XeroInvoiceMapping }
  | { entityType: "Bill"; mapping: XeroBillMapping };

/**
 * Persisted Xero OAuth connection for an organization (server-side row shape).
 */
export interface XeroOrgConnection {
  id: string;
  orgId: string;
  tenantId: string;
  tenantName: string | null;
  refreshTokenEncrypted: string;
  accessTokenEncrypted: string;
  accessTokenExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
