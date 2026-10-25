import { IS_QB_INTEGRATION_ENABLED } from "@zdocs/util";
import {
  disconnectQuickBooks,
  fetchQuickBooksIntegrationStatus,
  startQuickBooksOAuth,
} from "../../../utilities/api/quickbooksIntegrationApi";
import { QbAccountsImportDialog } from "./QbAccountsImportDialog";
import type { IntegrationDefinition } from "./IntegrationDefinition";

export const quickbooksIntegration: IntegrationDefinition = {
  id: "quickbooks",
  enabled: IS_QB_INTEGRATION_ENABLED,
  logo: {
    src: "/quickbook/quickbooks-brand-preferred-logo-50-50-black-external.png",
  },
  queryParam: "quickbooks",
  accountDriverType: "QB_ACCOUNT",
  externalUrl: "https://qbo.intuit.com/app/homepage",

  // Intuit requires the official "Connect to QuickBooks" button to trigger OAuth.
  // https://developer.intuit.com/.../naming-and-logo-guidelines#connect-to-quickbooks-button
  connectButton: {
    defaultSrc: "/svg/quickbooks/C2QB_green_btn_med_default.svg",
    hoverSrc: "/svg/quickbooks/C2QB_green_btn_med_hover.svg",
    width: 223,
    height: 36,
  },

  video: {
    src: "https://youtu.be/Pv1woIF_ngc",
    title: "Reconcile expense documents to QuickBooks transactions in Doc-Vision",
  },

  i18n: {
    title: "quickBooksTitle",
    description: "quickBooksDescription",
    idle: "quickBooksIdle",
    connect: "connectQuickBooks",
    disconnect: "disconnectQuickBooks",
    openExternal: "openQuickBooks",
    connectedDescription: "connectedDescription",
    connectStarted: "connectStarted",
    connectedToast: "connectedToast",
    disconnectedToast: "disconnectedToast",
    disconnectFailed: "disconnectFailed",
    connectFailed: "connectFailed",
    notConfigured: "notConfigured",
    oauthErrors: {
      denied: "oauthDenied",
      invalid: "oauthInvalid",
      invalid_state: "oauthInvalidState",
      token_error: "oauthTokenError",
      auth_required: "oauthAuthRequired",
      unauthorized_org: "oauthUnauthorizedOrg",
    },
  },

  fetchStatus: async (orgId) => {
    const data = await fetchQuickBooksIntegrationStatus(orgId);
    const connectionId = data.realmId?.trim() || null;
    return {
      connected: Boolean(data.connected && connectionId),
      connectionId,
      displayName: data.companyName || null,
    };
  },

  startOAuth: (orgId) => startQuickBooksOAuth(orgId),

  disconnect: async (orgId) => {
    await disconnectQuickBooks(orgId);
  },

  ImportDialog: QbAccountsImportDialog,
};
