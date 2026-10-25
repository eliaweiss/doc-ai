/**
 * Quick Access Types
 *
 * Types for user's enabled apps (system apps or mini apps)
 */

export type SystemAppId =
  | "files"
  | "settings"
  | "api-settings"
  | "search"
  | "reconciliation/workbench"
  | "reconciliation/ledger"
  | "ai-desk"
  | "ai-builder"
  | "schema"
  | "tasks"
  | "bank-links"
  | "data-sources"
  | "integrations"
  | "home";

// doc-ai: "api-settings" removed (no inbound webhook / API keys locally); "search" added
// (zdocs users add it from the Apps page, which doc-ai doesn't route)
export const DEFAULT_ENABLED_SYSTEM_APP_IDS: SystemAppId[] = ["files", "search", "schema", "settings"];

export type QuickAccessAppType = "system" | "mini_app";

/**
 * Quick Access Item stored in database
 */
export interface QuickAccessItem {
  id: string;
  orgId: string;
  userId: string;
  appId: string; // System app name (e.g., "browse", "search") or mini app id
  appType: QuickAccessAppType;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Quick Access Item creation params
 */
export interface CreateQuickAccessParams {
  orgId: string;
  userId: string;
  appId: string;
  appType: QuickAccessAppType;
  displayOrder?: number;
}

/**
 * Quick Access Item with resolved app data (for display)
 */
export interface QuickAccessItemWithApp {
  id: string;
  appId: string;
  appType: QuickAccessAppType;
  displayOrder: number;
  // System app data
  systemAppName?: string;
  systemAppPath?: string;
  // Mini app data
  miniAppName?: string;
  miniAppIcon?: string | null;
  miniAppColor?: string | null;
}
