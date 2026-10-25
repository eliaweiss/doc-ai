/**
 * Data Source Driver Types
 *
 * Public types describing the driver abstraction. The DataSourceDriver
 * interface itself lives in @zdocs/srv (it carries server-only deps).
 */

import type { FieldDefinition } from "./FieldDefinition";
import type { DataSource } from "./DataSource";

/**
 * Setup styles supported by the UI.
 * - mock_bank_link: Mock driver returns a list of mock bank/account choices
 * - file_upload: Driver expects a file upload (future)
 * - plaid_link: Plaid Link setup flow
 * - oauth: OAuth flow (future)
 * - custom: Driver-specific UI
 */
export const DRIVER_SETUP_TYPES = [
  "mock_bank_link",
  "file_upload",
  "plaid_link",
  "oauth",
  "custom",
] as const;
export type DriverSetupType = (typeof DRIVER_SETUP_TYPES)[number];

/**
 * Driver manifest - describes a driver to the UI without actually loading
 * any server-only code.
 */
export interface DriverManifest {
  driverType: string;
  displayName: string;
  description: string;
  /** Lucide icon name to render in the UI (e.g. "Landmark") */
  iconName: string;
  /** Hex color, e.g. "#10b981" */
  color: string;
  setupType: DriverSetupType;
  /**
   * Whether this driver supports daily cron auto-sync.
   * File upload drivers normally set this to false because there is nothing
   * to fetch automatically - the user must upload a new file.
   * Defaults to true if undefined.
   */
  supportsAutoSync?: boolean;
  /**
   * Whether this driver requires user input every time the user clicks
   * "Sync Now" (i.e. sync cannot run silently from the data source's
   * stored driverState alone).
   *
   * When true:
   *  - The UI opens a setup-style dialog instead of calling the regular
   *    /sync endpoint.
   *  - The dialog collects driver-specific input and POSTs it to
   *    /sync-with-input.
   *  - The driver MUST implement `applyResyncInput` on its server-side
   *    driver class.
   *
   * Defaults to false if undefined.
   */
  requiresInputOnSync?: boolean;
}

/**
 * Setup configuration returned by a driver's `getSetupConfig` call.
 * Drivers can return arbitrary options the UI knows how to render based on `type`.
 */
export interface DriverSetupConfig {
  type: DriverSetupType;
  /** Driver-specific setup options (e.g. mock bank list for mock_bank_link) */
  options?: unknown;
}

/**
 * Mock bank-link style setup options.
 */
export interface MockBankLinkSetupOptions {
  banks: Array<{
    bankId: string;
    bankName: string;
    logoIcon?: string;
  }>;
}

/**
 * File-upload style setup options.
 * Tells the UI which file types the driver accepts in the FilePicker.
 */
export interface FileUploadSetupOptions {
  /**
   * MIME-type to extensions map, matches react-dropzone's `accept` shape.
   * Example: `{ "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }`
   */
  acceptedFileTypes: Record<string, string[]>;
  /** Max file size in bytes (UI hint). */
  maxFileSizeBytes?: number;
}

/**
 * Result of a driver completing setup. The orchestrator uses this to create
 * the data source row and the backing dataset document.
 */
export interface DriverCompleteSetupResult {
  /** User-facing name for the data source, e.g. "Chase Checking" */
  name: string;
  /** Driver-owned config jsonb stored on the data_source row */
  config: Record<string, unknown>;
  /** Driver-owned encrypted config jsonb stored on the data_source row */
  encryptedConfig?: Record<string, unknown>;
  /** Initial driver state, e.g. lastFetchDate set to 90 days ago */
  initialState: Record<string, unknown>;
}

/**
 * Schema descriptor for the document type a driver creates.
 * Drivers control the line item collection name and field schema.
 */
export interface DriverSchemaDescriptor {
  /** Document type name, e.g. "MOCK_DATASOURCE_TRANSACTIONS" */
  docTypeName: string;
  /** Display name shown in the UI, e.g. "Mock Bank Transactions" */
  docTypeDisplayName: string;
  /** Description of the schema */
  description: string;
  /** Line items collection key, e.g. "transactions" */
  collectionKey: string;
  /** Display name of the line items collection, e.g. "Transactions" */
  collectionDisplayName: string;
  /** Field definitions for the line items */
  fields: FieldDefinition[];
}

/**
 * Result of a driver fetching new data.
 *
 * The driver returns normalized records (matching its own schema) plus the
 * updated cursor. The sync orchestrator handles dedup, appending to
 * document_data, and re-indexing in search_index.
 */
export interface DriverFetchResult {
  /** New records to add (driver may pre-dedup or rely on orchestrator dedup by id field) */
  records: Record<string, unknown>[];
  /** Updated driver state to persist (cursor advanced, etc.) */
  newDriverState: Record<string, unknown>;
  /** Optional: field name on each record that uniquely identifies it (for orchestrator dedup) */
  recordIdField?: string;
  /**
   * Optional: how to merge records into existing data.
   * - append: Add new records, dedup by recordIdField (default)
   * - replace: Replace all existing records with this set. If recordIdField is
   *   set, existing row order is preserved for matching ids so entity ids stay
   *   stable across full-set refreshes.
   */
  mergeMode?: "append" | "replace";
}

/**
 * Context passed to a driver when it needs DB access.
 * Keeps driver implementations testable without coupling to imports directly.
 */
export interface DriverContext {
  orgId: string;
}

/**
 * Available driver info returned to the UI by the /drivers endpoint.
 */
export type AvailableDriver = DriverManifest;

/**
 * Sync result returned to the UI / cron after a sync completes.
 */
export interface DataSourceSyncResult {
  dataSource: DataSource;
  added: number;
  skipped: number;
  removed: number;
  totalRecords: number;
}
