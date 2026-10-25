// ═══════════════════════════════════════════════════════════════════════════════
// INSTITUTION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const INSTITUTION_TYPES = [
  "BANK",
  "EMPLOYER",
  "MERCHANT",
  "GOVERNMENT",
  "INVESTMENT_FIRM",
  "OTHER",
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// INSTITUTION INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Institution record from institutions table.
 * Institutions are per-organization (multi-tenant).
 * Used for vendors, banks, employers, etc.
 */
export interface Institution {
  id: string;
  orgId: string;

  /** Display name (e.g., "Amazon", "Chase Bank") */
  name: string;

  /** Normalized name for matching (lowercase, trimmed) */
  normalizedName: string;

  /** Type of institution for categorization */
  type: InstitutionType | null;

  /** Domain for logo/enrichment (e.g., "amazon.com") */
  domain: string | null;

  /** Description for search context */
  description: string | null;

  /** Additional metadata */
  metadata: Record<string, unknown> | null;

  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
