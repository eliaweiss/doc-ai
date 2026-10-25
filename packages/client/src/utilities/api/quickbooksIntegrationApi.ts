import { zFetch } from "../../lib/utils";

export async function fetchQuickBooksIntegrationStatus(orgId: string): Promise<{
  connected: boolean;
  realmId?: string;
  companyName?: string | null;
}> {
  return zFetch(`/api/org/${orgId}/integrations/quickbooks/status`, {
    method: "POST",
    body: {},
  });
}

export async function startQuickBooksOAuth(orgId: string): Promise<{
  authorizationUrl: string;
}> {
  return zFetch(`/api/org/${orgId}/integrations/quickbooks/start`, {
    method: "POST",
    body: {},
  });
}

export async function disconnectQuickBooks(orgId: string): Promise<{ ok: boolean }> {
  return zFetch(`/api/org/${orgId}/integrations/quickbooks/disconnect`, {
    method: "POST",
    body: {},
  });
}

export interface QbAccountItem {
  id: string;
  name: string;
  accountType: string;
  accountSubType: string;
  active: boolean;
}

export async function fetchQbAccountsForOrg(
  orgId: string
): Promise<{ accounts: QbAccountItem[] }> {
  return zFetch(`/api/org/${orgId}/integrations/quickbooks/accounts`, {
    method: "POST",
    body: {},
  });
}

export interface ImportQbAccountsResult {
  created: Array<{ id: string; name: string; accountId: string }>;
  errors: string[];
}

export async function importQbAccounts(
  orgId: string,
  accounts: Array<{ id: string; name: string; accountType: string; accountSubType?: string }>
): Promise<ImportQbAccountsResult> {
  return zFetch(`/api/org/${orgId}/integrations/quickbooks/import-accounts`, {
    method: "POST",
    body: { accounts },
  });
}
