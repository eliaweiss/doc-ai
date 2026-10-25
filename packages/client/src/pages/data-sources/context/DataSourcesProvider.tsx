"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import type { DataSource, DriverManifest } from "@zdocs/types";
import { toast } from "sonner";
import {
  createDataSource,
  deleteDataSource,
  fetchDataSourceDrivers,
  fetchDataSources,
  syncDataSourceNow,
  syncDataSourceWithInput,
  updateDataSource,
} from "../../../utilities/api/dataSourceApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

const BANK_LINK_SETUP_TYPES = new Set(["plaid_link", "mock_bank_link"]);
/**
 * Known driver types that are bank-link products.
 * Used as a fallback when the driver manifest is not available
 * (e.g. driver disabled server-side but data sources still exist).
 */
const BANK_LINK_DRIVER_TYPES = new Set([
  "PLAID_TRANSACTIONS",
  "MOCK_BANK_LINK",
]);

export type DataSourceFilterMode = "bank-links" | "data-sources" | "all";

interface DataSourcesContextValue {
  orgId: string;
  dataSources: DataSource[];
  drivers: DriverManifest[];
  isLoading: boolean;

  isAddDialogOpen: boolean;
  setAddDialogOpen: (open: boolean) => void;

  refreshDataSources: () => Promise<void>;
  syncingIds: Set<string>;
  syncDataSourceById: (id: string) => Promise<void>;
  toggleCron: (id: string, cronEnabled: boolean) => Promise<void>;
  removeDataSource: (id: string, deleteData: boolean) => Promise<void>;
  createNewDataSource: (
    driverType: string,
    setupData: unknown
  ) => Promise<DataSource | null>;
  /**
   * Driver-agnostic resync entry point.
   * Sends `input` to the driver's `applyResyncInput`, then runs the standard sync.
   * Only valid for drivers whose manifest declares `requiresInputOnSync: true`.
   */
  syncWithInputById: (id: string, input: unknown) => Promise<boolean>;
}

const DataSourcesContext = createContext<DataSourcesContextValue | null>(null);

export function DataSourcesProvider({
  orgId,
  filterMode = "all",
  translationNamespace = "dataSources",
  children,
}: {
  orgId: string;
  filterMode?: DataSourceFilterMode;
  translationNamespace?: "dataSources" | "bankLinks";
  children: React.ReactNode;
}) {
  const t = useTranslations(translationNamespace);
  const { logEvent } = useLogUserJourneyEvent();
  const [allDataSources, setAllDataSources] = useState<DataSource[]>([]);
  const [allDrivers, setAllDrivers] = useState<DriverManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const isBankLinkDriver = useCallback(
    (driverType: string) => {
      const manifest = allDrivers.find((d) => d.driverType === driverType);
      if (manifest) return BANK_LINK_SETUP_TYPES.has(manifest.setupType);
      return BANK_LINK_DRIVER_TYPES.has(driverType);
    },
    [allDrivers]
  );

  const dataSources = useMemo(() => {
    if (filterMode === "all") return allDataSources;
    if (filterMode === "bank-links")
      return allDataSources.filter((ds) => isBankLinkDriver(ds.driverType));
    return allDataSources.filter((ds) => !isBankLinkDriver(ds.driverType));
  }, [allDataSources, filterMode, isBankLinkDriver]);

  const drivers = useMemo(() => {
    if (filterMode === "all") return allDrivers;
    if (filterMode === "bank-links")
      return allDrivers.filter((d) => BANK_LINK_SETUP_TYPES.has(d.setupType));
    return allDrivers.filter((d) => !BANK_LINK_SETUP_TYPES.has(d.setupType));
  }, [allDrivers, filterMode]);

  const refreshDataSources = useCallback(async () => {
    try {
      logEvent({
        eventType: "data_sources_list_requested",
        eventData: { orgId },
      });
      const [list, driverList] = await Promise.all([
        fetchDataSources(orgId),
        fetchDataSourceDrivers(orgId),
      ]);
      setAllDataSources(list);
      setAllDrivers(driverList);
      logEvent({
        eventType: "data_sources_list_loaded",
        eventData: {
          orgId,
          dataSourceCount: list.length,
          driverCount: driverList.length,
          driverTypes: driverList.map((driver) => driver.driverType),
        },
      });
    } catch (err) {
      console.error("Failed to load data sources", err);
      logEvent({
        eventType: "data_sources_list_error",
        eventData: {
          orgId,
          errorType: err instanceof Error ? err.name : "unknown",
        },
      });
      toast.error(t("loadError"));
    }
  }, [logEvent, orgId, t]);

  useEffect(() => {
    setIsLoading(true);
    refreshDataSources().finally(() => setIsLoading(false));
  }, [refreshDataSources]);

  const markSyncing = useCallback((id: string, on: boolean) => {
    setSyncingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const syncDataSourceById = useCallback(
    async (id: string) => {
      markSyncing(id, true);
      const dataSource = allDataSources.find((ds) => ds.id === id);
      logEvent({
        eventType: "data_sources_sync_requested",
        eventData: {
          dataSourceId: id,
          driverType: dataSource?.driverType ?? null,
          source: "manual",
        },
      });
      try {
        const result = await syncDataSourceNow(orgId, id);
        setAllDataSources((prev) =>
          prev.map((ds) => (ds.id === id ? result.dataSource : ds))
        );
        logEvent({
          eventType: "data_sources_sync_success",
          eventData: {
            dataSourceId: id,
            driverType: result.dataSource.driverType,
            added: result.sync.added,
            skipped: result.sync.skipped,
            removed: result.sync.removed,
            totalRecords: result.sync.totalRecords,
            hadNewRecords: result.sync.added > 0,
          },
        });
        if (result.sync.added === 0) {
          toast.info(t("syncNoNewRecords"));
        } else {
          toast.success(t("syncComplete", { count: result.sync.added }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t("syncFailed");
        logEvent({
          eventType: "data_sources_sync_error",
          eventData: {
            dataSourceId: id,
            driverType: dataSource?.driverType ?? null,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        toast.error(message);
        await refreshDataSources();
      } finally {
        markSyncing(id, false);
      }
    },
    [allDataSources, logEvent, markSyncing, orgId, refreshDataSources, t]
  );

  const toggleCron = useCallback(
    async (id: string, cronEnabled: boolean) => {
      const dataSource = allDataSources.find((ds) => ds.id === id);
      logEvent({
        eventType: "data_sources_auto_sync_toggled",
        eventData: {
          dataSourceId: id,
          driverType: dataSource?.driverType ?? null,
          enabled: cronEnabled,
        },
      });
      try {
        const updated = await updateDataSource(orgId, id, { cronEnabled });
        setAllDataSources((prev) =>
          prev.map((ds) => (ds.id === id ? updated : ds))
        );
        logEvent({
          eventType: "data_sources_auto_sync_toggle_success",
          eventData: {
            dataSourceId: id,
            driverType: updated.driverType,
            enabled: updated.cronEnabled,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : t("updateFailed");
        logEvent({
          eventType: "data_sources_auto_sync_toggle_error",
          eventData: {
            dataSourceId: id,
            driverType: dataSource?.driverType ?? null,
            enabled: cronEnabled,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        toast.error(message);
      }
    },
    [allDataSources, logEvent, orgId, t]
  );

  const removeDataSource = useCallback(
    async (id: string, deleteData: boolean) => {
      const dataSource = allDataSources.find((ds) => ds.id === id);
      logEvent({
        eventType: "data_sources_delete_requested",
        eventData: {
          dataSourceId: id,
          driverType: dataSource?.driverType ?? null,
          deleteData,
        },
      });
      try {
        await deleteDataSource(orgId, id, deleteData);
        setAllDataSources((prev) => prev.filter((ds) => ds.id !== id));
        logEvent({
          eventType: "data_sources_delete_success",
          eventData: {
            dataSourceId: id,
            driverType: dataSource?.driverType ?? null,
            deleteData,
          },
        });
        toast.success(t("removeSuccess"));
      } catch (err) {
        const message = err instanceof Error ? err.message : t("deleteFailed");
        logEvent({
          eventType: "data_sources_delete_error",
          eventData: {
            dataSourceId: id,
            driverType: dataSource?.driverType ?? null,
            deleteData,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        toast.error(message);
      }
    },
    [allDataSources, logEvent, orgId, t]
  );

  const createNewDataSource = useCallback(
    async (driverType: string, setupData: unknown) => {
      logEvent({
        eventType: "data_sources_create_requested",
        eventData: { driverType },
      });
      try {
        const result = await createDataSource(orgId, { driverType, setupData });
        setAllDataSources((prev) => [result.dataSource, ...prev]);
        logEvent({
          eventType: "data_sources_create_success",
          eventData: {
            dataSourceId: result.dataSource.id,
            driverType: result.dataSource.driverType,
            added: result.sync.added,
            totalRecords: result.sync.totalRecords,
          },
        });
        toast.success(
          t("connectSuccess", {
            name: result.dataSource.name,
            count: result.sync.added,
          })
        );
        return result.dataSource;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("createFailed");
        logEvent({
          eventType: "data_sources_create_error",
          eventData: {
            driverType,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        toast.error(message);
        return null;
      }
    },
    [logEvent, orgId, t]
  );

  const syncWithInputById = useCallback(
    async (id: string, input: unknown) => {
      markSyncing(id, true);
      const dataSource = allDataSources.find((ds) => ds.id === id);
      logEvent({
        eventType: "data_sources_sync_with_input_requested",
        eventData: {
          dataSourceId: id,
          driverType: dataSource?.driverType ?? null,
        },
      });
      try {
        const result = await syncDataSourceWithInput(orgId, id, input);
        setAllDataSources((prev) =>
          prev.map((ds) => (ds.id === id ? result.dataSource : ds))
        );
        logEvent({
          eventType: "data_sources_sync_with_input_success",
          eventData: {
            dataSourceId: id,
            driverType: result.dataSource.driverType,
            added: result.sync.added,
            removed: result.sync.removed,
            totalRecords: result.sync.totalRecords,
          },
        });
        toast.success(
          t("syncWithInputComplete", { count: result.sync.totalRecords })
        );
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("syncWithInputFailed");
        logEvent({
          eventType: "data_sources_sync_with_input_error",
          eventData: {
            dataSourceId: id,
            driverType: dataSource?.driverType ?? null,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        toast.error(message);
        await refreshDataSources();
        return false;
      } finally {
        markSyncing(id, false);
      }
    },
    [allDataSources, logEvent, markSyncing, orgId, refreshDataSources, t]
  );

  const value = useMemo<DataSourcesContextValue>(
    () => ({
      orgId,
      dataSources,
      drivers,
      isLoading,
      isAddDialogOpen,
      setAddDialogOpen,
      refreshDataSources,
      syncingIds,
      syncDataSourceById,
      toggleCron,
      removeDataSource,
      createNewDataSource,
      syncWithInputById,
    }),
    [
      orgId,
      dataSources,
      drivers,
      isLoading,
      isAddDialogOpen,
      refreshDataSources,
      syncingIds,
      syncDataSourceById,
      toggleCron,
      removeDataSource,
      createNewDataSource,
      syncWithInputById,
    ]
  );

  return (
    <DataSourcesContext.Provider value={value}>
      {children}
    </DataSourcesContext.Provider>
  );
}

export function useDataSources(): DataSourcesContextValue {
  const ctx = useContext(DataSourcesContext);
  if (!ctx) {
    throw new Error("useDataSources must be used within DataSourcesProvider");
  }
  return ctx;
}
