/**
 * Data Source Types
 *
 * A Data Source is an external connector (driver-based) that fetches data
 * into the system as a regular dataset document. The driver layer handles
 * fetching/normalizing; storage uses standard documents/document_data/search_index.
 */

export const DATA_SOURCE_STATUSES = [
  "SETUP", // Setup in progress (created but not yet fetched)
  "ACTIVE", // Successfully syncing
  "ERROR", // Last sync failed
  "DISABLED", // User disabled the data source
] as const;
export type DataSourceStatus = (typeof DATA_SOURCE_STATUSES)[number];

/**
 * Data Source record from database.
 *
 * The data source row tracks the connector metadata, driver-specific cursor
 * state, and the backing dataset document where records are stored.
 */
export interface DataSource {
  id: string;
  orgId: string;

  /** Driver type identifier, e.g. "MOCK_DATASOURCE", "PLAID", "FILE" */
  driverType: string;

  /** User-friendly name, e.g. "Chase Checking" */
  name: string;

  status: DataSourceStatus;

  /** Backing dataset document id (set after first sync) */
  documentId: string | null;

  /** Document type name used by this data source (set after first sync) */
  docType: string | null;

  /**
   * Driver-specific cursor / state, e.g. lastTransactionDate, accessToken hash, etc.
   * The driver fully owns the shape of this jsonb.
   */
  driverState: Record<string, unknown>;

  /**
   * Driver-specific config captured during setup, e.g. selected bank/account info.
   * The driver fully owns the shape of this jsonb.
   */
  config: Record<string, unknown>;

  /**
   * Driver-specific encrypted config, e.g. access tokens.
   * The driver fully owns the shape of this jsonb.
   */
  encryptedConfig: Record<string, unknown>;

  /** Whether daily cron sync is enabled */
  cronEnabled: boolean;

  /** Last successful or attempted sync timestamp */
  lastSyncAt: Date | null;

  /** Error message from the last failed sync (cleared on next success) */
  lastSyncError: string | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Params for creating a data source.
 * `documentId`, `docType`, `lastSyncAt`, `lastSyncError` are populated by the sync orchestrator.
 */
export interface CreateDataSourceParams {
  driverType: string;
  name: string;
  config: Record<string, unknown>;
  encryptedConfig?: Record<string, unknown>;
  driverState: Record<string, unknown>;
  status?: DataSourceStatus;
  cronEnabled?: boolean;
}

/**
 * Params for updating a data source.
 */
export interface UpdateDataSourceParams {
  name?: string;
  status?: DataSourceStatus;
  documentId?: string | null;
  docType?: string | null;
  driverState?: Record<string, unknown>;
  config?: Record<string, unknown>;
  encryptedConfig?: Record<string, unknown>;
  cronEnabled?: boolean;
  lastSyncAt?: Date | null;
  lastSyncError?: string | null;
}
