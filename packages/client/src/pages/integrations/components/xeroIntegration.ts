import { IS_XERO_INTEGRATION_ENABLED } from "@zdocs/util";
import {
  disconnectXero,
  fetchXeroIntegrationStatus,
  startXeroOAuth,
} from "../../../utilities/api/xeroIntegrationApi";
import { XeroAccountsImportDialog } from "./XeroAccountsImportDialog";
import type { IntegrationDefinition } from "./IntegrationDefinition";

export const xeroIntegration: IntegrationDefinition = {
  id: "xero",
  enabled: IS_XERO_INTEGRATION_ENABLED,
  logo: {
    src: "/svg/xero_logo.webp",
  },
  queryParam: "xero",
  accountDriverType: "XERO_ACCOUNT",
  externalUrl: "https://go.xero.com",

  video: {
    src: "https://youtu.be/VnYdb1BbUkM",
    title: "Reconcile expense documents to Xero transactions in Doc-Vision",
  },

  i18n: {
    title: "xeroTitle",
    description: "xeroDescription",
    idle: "xeroIdle",
    connect: "connectXero",
    disconnect: "disconnectXero",
    openExternal: "openXero",
    connectedDescription: "xeroConnectedDescription",
    connectStarted: "xeroConnectStarted",
    connectedToast: "xeroConnectedToast",
    disconnectedToast: "xeroDisconnectedToast",
    disconnectFailed: "xeroDisconnectFailed",
    connectFailed: "xeroConnectFailed",
    notConfigured: "xeroNotConfigured",
    oauthErrors: {
      denied: "xeroOauthDenied",
      invalid: "xeroOauthInvalid",
      invalid_state: "xeroOauthInvalidState",
      token_error: "xeroOauthTokenError",
      auth_required: "xeroOauthAuthRequired",
      unauthorized_org: "xeroOauthUnauthorizedOrg",
      no_tenant: "xeroOauthNoTenant",
    },
  },

  fetchStatus: async (orgId) => {
    const data = await fetchXeroIntegrationStatus(orgId);
    const connectionId = data.tenantId?.trim() || null;
    return {
      connected: Boolean(data.connected && connectionId),
      connectionId,
      displayName: data.tenantName || null,
    };
  },

  startOAuth: (orgId) => startXeroOAuth(orgId),

  disconnect: async (orgId) => {
    await disconnectXero(orgId);
  },

  ImportDialog: XeroAccountsImportDialog,
};
