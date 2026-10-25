/**
 * API Key Types
 *
 * Types for API keys used to authenticate external Mini App clients.
 */

/**
 * API Key rate limits
 */
export interface ApiKeyRateLimits {
  rpm: number; // Requests per minute
  burst: number; // Max burst size
}

/**
 * API Key scopes - currently empty, for future use
 */
export interface ApiKeyScopes {
  // Currently no scopes - keys have full org access
  // Future: could add read-only, specific doc types, etc.
}

/**
 * API Key stored in database
 */
export interface ApiKey {
  id: string;
  orgId: string;
  userId: string; // User who created the key
  name: string; // Human-readable name
  keyHash: string; // SHA-256 hash of the key
  keyPrefix: string; // First 8 chars for identification (e.g., "zdocs_12")
  scopes: ApiKeyScopes;
  rateLimits: ApiKeyRateLimits;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
}

/**
 * API Key creation params
 */
export interface CreateApiKeyParams {
  orgId: string;
  userId: string;
  name: string;
  scopes?: ApiKeyScopes;
  rateLimits?: ApiKeyRateLimits;
  expiresAt?: Date | null;
}

/**
 * API Key creation result - includes the plain key (only shown once)
 */
export interface CreateApiKeyResult {
  id: string;
  key: string; // The actual API key (only returned on creation)
  keyPrefix: string;
  name: string;
  createdAt: Date;
}

/**
 * API Key for display (without sensitive data)
 */
export interface ApiKeyDisplay {
  id: string;
  orgId: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}
