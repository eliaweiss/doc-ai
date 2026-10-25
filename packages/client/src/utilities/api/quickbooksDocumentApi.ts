import { zFetch } from "../../lib/utils";
import type {
  QuickBooksPurchaseMapping,
  QuickBooksPushBody,
  QbEntityType,
} from "@zdocs/types";

export interface QbDocumentStatus {
  connected: boolean;
  companyName?: string | null;
  purchaseMapping?: QuickBooksPurchaseMapping | null;
  synced?: boolean;
  entityType?: QbEntityType | null;
  entityId?: string | null;
  syncedAt?: string | null;
  syncData?: Record<string, unknown> | null;
}

export async function fetchQbDocumentStatus(
  orgId: string,
  documentId: string
): Promise<QbDocumentStatus> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/status`,
    { method: "POST", body: {} }
  );
}

export interface QbAccountItem {
  id: string;
  name: string;
  accountType: string;
  accountSubType: string;
  active: boolean;
}

export async function fetchQbAccounts(
  orgId: string,
  documentId: string
): Promise<{ accounts: QbAccountItem[] }> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/accounts`,
    { method: "POST", body: {} }
  );
}

export interface QbCustomerItem {
  id: string;
  displayName: string;
  companyName: string | null;
  active: boolean;
}

export async function fetchQbCustomers(
  orgId: string,
  documentId: string
): Promise<{ customers: QbCustomerItem[] }> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/customers`,
    { method: "POST", body: {} }
  );
}

export interface QbVendorItem {
  id: string;
  displayName: string;
  companyName: string | null;
  active: boolean;
}

export async function fetchQbVendors(
  orgId: string,
  documentId: string
): Promise<{ vendors: QbVendorItem[] }> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/vendors`,
    { method: "POST", body: {} }
  );
}

export interface QbItemOption {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

export async function fetchQbItems(
  orgId: string,
  documentId: string
): Promise<{ items: QbItemOption[] }> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/items`,
    { method: "POST", body: {} }
  );
}

export interface QbOpenBillItem {
  id: string;
  vendorRefId: string;
  vendorName: string;
  txnDate: string | null;
  dueDate: string | null;
  balance: number;
  totalAmt: number;
}

export async function fetchQbOpenBills(
  orgId: string,
  documentId: string
): Promise<{ bills: QbOpenBillItem[] }> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/bills`,
    { method: "POST", body: {} }
  );
}

export async function updateQbDocument(
  orgId: string,
  documentId: string
): Promise<{ success: boolean; entityType: string; entityId: string }> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/update`,
    { method: "POST", body: {} }
  );
}

export async function deleteQbDocument(
  orgId: string,
  documentId: string
): Promise<{ success: boolean }> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/delete`,
    { method: "POST", body: {} }
  );
}

export async function pushDocumentToQuickBooks(
  orgId: string,
  documentId: string,
  body: QuickBooksPushBody
): Promise<{
  success: boolean;
  entityType: QbEntityType;
  entityId: string | null;
  alreadyPushed?: boolean;
  response: Record<string, unknown>;
}> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/quickbooks/push`,
    { method: "POST", body }
  );
}
