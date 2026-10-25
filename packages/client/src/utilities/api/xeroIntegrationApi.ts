import { zFetch } from "../../lib/utils";

export async function fetchXeroIntegrationStatus(orgId: string): Promise<{
  connected: boolean;
  tenantId?: string;
  tenantName?: string | null;
}> {
  return zFetch(`/api/org/${orgId}/integrations/xero/status`, {
    method: "POST",
    body: {},
  });
}

export async function startXeroOAuth(orgId: string): Promise<{
  authorizationUrl: string;
}> {
  return zFetch(`/api/org/${orgId}/integrations/xero/start`, {
    method: "POST",
    body: {},
  });
}

export async function disconnectXero(orgId: string): Promise<{ ok: boolean }> {
  return zFetch(`/api/org/${orgId}/integrations/xero/disconnect`, {
    method: "POST",
    body: {},
  });
}

export interface XeroAccountItem {
  id: string;
  name: string;
  code: string;
  accountType: string;
  bankAccountType: string;
  status: string;
}

export async function fetchXeroAccountsForOrg(
  orgId: string
): Promise<{ accounts: XeroAccountItem[] }> {
  return zFetch(`/api/org/${orgId}/integrations/xero/accounts`, {
    method: "POST",
    body: {},
  });
}

export interface ImportXeroAccountsResult {
  created: Array<{ id: string; name: string; accountId: string }>;
  errors: string[];
}

export async function importXeroAccounts(
  orgId: string,
  accounts: Array<{
    id: string;
    name: string;
    accountType: string;
    bankAccountType?: string;
  }>
): Promise<ImportXeroAccountsResult> {
  return zFetch(`/api/org/${orgId}/integrations/xero/import-accounts`, {
    method: "POST",
    body: { accounts },
  });
}
