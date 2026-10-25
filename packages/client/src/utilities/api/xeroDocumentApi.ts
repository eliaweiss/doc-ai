import { zFetch } from "../../lib/utils";
import type {
  XeroEntityType,
  XeroPushBody,
} from "@zdocs/types";

export interface XeroDocumentStatus {
  connected: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
  synced?: boolean;
  entityType?: XeroEntityType | null;
  entityId?: string | null;
  syncedAt?: string | null;
  syncData?: Record<string, unknown> | null;
}

export interface XeroContactItem {
  id: string;
  name: string;
  emailAddress: string | null;
  status: string;
}

export interface XeroChartAccountItem {
  id: string;
  name: string;
  code: string;
  accountType: string;
  bankAccountType: string;
  status: string;
}

export interface XeroTaxRateItem {
  name: string;
  taxType: string;
  status: string;
  effectiveRate: number | null;
}

export async function fetchXeroDocumentStatus(
  orgId: string,
  documentId: string
): Promise<XeroDocumentStatus> {
  return zFetch(`/api/org/${orgId}/documents/${documentId}/xero/status`, {
    method: "POST",
    body: {},
  });
}

export async function fetchXeroContacts(
  orgId: string
): Promise<{ contacts: XeroContactItem[] }> {
  return zFetch(`/api/org/${orgId}/integrations/xero/contacts`, {
    method: "POST",
    body: {},
  });
}

export async function fetchXeroChartAccounts(
  orgId: string,
  accountType?: string
): Promise<{ accounts: XeroChartAccountItem[] }> {
  return zFetch(`/api/org/${orgId}/integrations/xero/chart-accounts`, {
    method: "POST",
    body: { accountType },
  });
}

export async function fetchXeroTaxRates(
  orgId: string
): Promise<{ taxRates: XeroTaxRateItem[] }> {
  return zFetch(`/api/org/${orgId}/integrations/xero/tax-rates`, {
    method: "POST",
    body: {},
  });
}

export async function pushDocumentToXero(
  orgId: string,
  documentId: string,
  body: XeroPushBody
): Promise<{
  success: boolean;
  entityType: XeroEntityType;
  entityId: string | null;
  alreadyPushed?: boolean;
  response: Record<string, unknown>;
}> {
  return zFetch(`/api/org/${orgId}/documents/${documentId}/xero/push`, {
    method: "POST",
    body,
  });
}

export async function updateXeroDocument(
  orgId: string,
  documentId: string
): Promise<{ success: boolean; entityType: string; entityId: string }> {
  return zFetch(`/api/org/${orgId}/documents/${documentId}/xero/update`, {
    method: "POST",
    body: {},
  });
}

export async function deleteXeroDocument(
  orgId: string,
  documentId: string
): Promise<{ success: boolean }> {
  return zFetch(`/api/org/${orgId}/documents/${documentId}/xero/delete`, {
    method: "POST",
    body: {},
  });
}
