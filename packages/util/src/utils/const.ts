
export const APP_DISPLAY_NAME =
  process.env.NEXT_PUBLIC_APP_NAME || "1Flow";

export const IS_DOC_VISION = process.env.NEXT_PUBLIC_APP_FLAVOR === "doc-vision";

/**
 * Master switch for the External Dataset / Data Sources feature.
 *
 * When false (the default), we hide the system app, return 404 for all
 * /api/.../data-sources/* routes, redirect /data-sources, and skip the
 * data-source sync cron.
 *
 * NEXT_PUBLIC_* so the client bundle can hide UI surfaces.
 */
export const IS_DATASET_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DATASET === "true";

/**
 * Switch for Bank Links / Plaid (client + server).
 *
 * Controls the bank-links system app, /bank-links page, and
 * server-side Plaid driver registration.
 */
export const IS_BANK_LINKS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_BANK_LINKS === "true";

/**
 * Switch for QuickBooks integration (client + server).
 *
 * Controls the integrations system app, /integrations page,
 * and server-side QB driver registration.
 */
export const IS_QB_INTEGRATION_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_QB_INTEGRATION === "true";

/**
 * Switch for Xero integration (client + server).
 *
 * Controls the integrations system app, /integrations page,
 * and server-side Xero driver registration.
 */
export const IS_XERO_INTEGRATION_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_XERO_INTEGRATION === "true";
export const INBOUND_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_EMAIL_INBOX_DOMAIN || "inbox.1flow.io";

/**
 * Default sender email address for SES emails.
 * Must match a verified domain in AWS SES.
 * Derives from INBOUND_EMAIL_DOMAIN so each white-label deployment sends from its own domain.
 */
export const SES_FROM_EMAIL =
  process.env.SES_FROM_EMAIL || `noreply@${INBOUND_EMAIL_DOMAIN}`;

export function buildInboundEmailAddress(emailId: string): string {
  return `${emailId}@${INBOUND_EMAIL_DOMAIN}`;
}

export const OCR_PLUS_MAX = {
  id: "OCR_PLUS_MAX" as const,
  name: "Vision OCR+ MAX",
  pricePerPage: 0.04,
};

export const OCR_PLUS_LITE = {
  id: "OCR_PLUS_LITE" as const,
  name: "Vision OCR+ Lite",
  pricePerPage: 0.02,
};