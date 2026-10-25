// ═══════════════════════════════════════════════════════════════════════════════
// USER ORG SETTINGS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options stored in the JSONB field of UserOrgSettings
 */
export interface UserOrgSettingsOptions {
  pinnedChatIds: string[];
}

/**
 * Per-user, per-organization settings and preferences
 */
export interface UserOrgSettings {
  id: string;
  orgId: string;
  userId: string;
  options: UserOrgSettingsOptions;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parameters for updating UserOrgSettings
 */
export interface UpdateUserOrgSettingsParams {
  options: Partial<UserOrgSettingsOptions>;
}
