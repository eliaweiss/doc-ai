import { zFetch } from "../../lib/utils";
import type {
  DataSource,
  DataSourceSyncResult,
  DriverManifest,
  DriverSetupConfig,
  DatasetTransformConfig,
  FieldDefinition,
  UpdateDataSourceParams,
} from "@zdocs/types";

export interface ListDataSourcesResponse {
  dataSources: DataSource[];
}

export interface ListDriversResponse {
  drivers: DriverManifest[];
}

export interface DriverSetupConfigResponse {
  manifest: DriverManifest;
  setupConfig: DriverSetupConfig;
}

export interface DataSourceSyncResponse {
  dataSource: DataSource;
  sync: {
    added: number;
    skipped: number;
    removed: number;
    totalRecords: number;
  };
}

export interface UpdateDataSourceResponse {
  dataSource: DataSource;
}

/** List all data sources for an organization. */
export async function fetchDataSources(orgId: string): Promise<DataSource[]> {
  const data = (await zFetch(`/api/org/${orgId}/data-sources`, {
    method: "POST",
  })) as ListDataSourcesResponse;
  return data.dataSources;
}

/** List all available drivers (manifests). */
export async function fetchDataSourceDrivers(
  orgId: string
): Promise<DriverManifest[]> {
  const data = (await zFetch(`/api/org/${orgId}/data-sources/drivers`, {
    method: "POST",
  })) as ListDriversResponse;
  return data.drivers;
}

/** Fetch driver setup config (e.g. mock bank list for mock_bank_link drivers). */
export async function fetchDriverSetupConfig(
  orgId: string,
  driverType: string
): Promise<DriverSetupConfigResponse> {
  return (await zFetch(
    `/api/org/${orgId}/data-sources/drivers/${driverType}/setup-config`,
    { method: "POST" }
  )) as DriverSetupConfigResponse;
}

/** Create a data source - runs driver.completeSetup + initial sync. */
export async function createDataSource(
  orgId: string,
  params: { driverType: string; setupData: unknown }
): Promise<DataSourceSyncResponse> {
  return (await zFetch(`/api/org/${orgId}/data-sources/create`, {
    method: "POST",
    body: params,
  })) as DataSourceSyncResponse;
}

export async function createPlaidLinkToken(orgId: string): Promise<string> {
  const data = (await zFetch(
    `/api/org/${orgId}/data-sources/drivers/PLAID_TRANSACTIONS/create-link-token`,
    { method: "POST" }
  )) as { linkToken: string };
  return data.linkToken;
}

export async function exchangePlaidPublicToken(
  orgId: string,
  publicToken: string,
  metadata: unknown
): Promise<unknown> {
  const data = (await zFetch(
    `/api/org/${orgId}/data-sources/drivers/PLAID_TRANSACTIONS/exchange-public-token`,
    {
      method: "POST",
      body: { publicToken, metadata },
    }
  )) as { setupData: unknown };
  return data.setupData;
}

/** Trigger a manual sync for a data source. */
export async function syncDataSourceNow(
  orgId: string,
  id: string
): Promise<DataSourceSyncResponse> {
  return (await zFetch(`/api/org/${orgId}/data-sources/${id}/sync`, {
    method: "POST",
  })) as DataSourceSyncResponse;
}

/** Update safe fields on a data source (name, cronEnabled, status). */
export async function updateDataSource(
  orgId: string,
  id: string,
  update: Pick<UpdateDataSourceParams, "name" | "cronEnabled" | "status">
): Promise<DataSource> {
  const data = (await zFetch(`/api/org/${orgId}/data-sources/${id}/update`, {
    method: "POST",
    body: update,
  })) as UpdateDataSourceResponse;
  return data.dataSource;
}

/** Soft delete a data source. Optionally delete the backing document and its data. */
export async function deleteDataSource(
  orgId: string,
  id: string,
  deleteData = false
): Promise<void> {
  await zFetch(`/api/org/${orgId}/data-sources/${id}/delete`, {
    method: "POST",
    body: { deleteData },
  });
}

export interface DatasetPreviewResponse {
  preview: {
    headers: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    schema: FieldDefinition[];
    transform?: DatasetTransformConfig;
  };
  suggestions: {
    datasetName: string;
    matchedTypeId: string | null;
    matchedTypeName: string | null;
  };
}

/**
 * Run AI preview parsing on an uploaded sample file.
 * Used by the file-dataset setup flow to show schema + sample rows for confirmation.
 */
export async function previewDatasetFile(
  orgId: string,
  documentId: string
): Promise<DatasetPreviewResponse> {
  return (await zFetch(`/api/org/${orgId}/datasets/preview`, {
    method: "POST",
    body: { documentId },
  })) as DatasetPreviewResponse;
}

/**
 * Trigger a sync that requires user-supplied input (e.g. file dataset re-upload,
 * future OAuth re-link). The driver's `applyResyncInput` is called server-side
 * with the opaque `input` payload, then the regular sync runs.
 *
 * Only valid for drivers whose manifest declares `requiresInputOnSync: true`.
 */
export async function syncDataSourceWithInput(
  orgId: string,
  id: string,
  input: unknown
): Promise<DataSourceSyncResponse> {
  return (await zFetch(
    `/api/org/${orgId}/data-sources/${id}/sync-with-input`,
    {
      method: "POST",
      body: { input },
    }
  )) as DataSourceSyncResponse;
}

export type { DataSource, DataSourceSyncResult, DriverManifest };
