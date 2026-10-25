"use client";

import { useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Trash2, Database, ExternalLink } from "lucide-react";
import type { DataSource, DriverManifest, DriverSetupType } from "@zdocs/types";
import { formatDate } from "@zdocs/util";
import {
  Badge,
  Button,
  Checkbox,
  Switch,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zdocs/client-component";
import { useDataSources } from "../context/DataSourcesProvider";
import { DataSourceStatusBadge } from "./DataSourceStatusBadge";
import { FileDatasetSyncDialog } from "./FileDatasetSyncDialog";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

/**
 * Sync-with-input dialogs are dispatched by `manifest.setupType`, NOT by
 * `driverType`. Drivers that share a setup style get the dialog for free.
 */
interface ResyncDialogProps {
  dataSource: DataSource;
  driver: DriverManifest;
  open: boolean;
  onClose: () => void;
}

const RESYNC_DIALOG_BY_TYPE: Partial<
  Record<DriverSetupType, ComponentType<ResyncDialogProps>>
> = {
  file_upload: FileDatasetSyncDialog,
};

interface DataSourceCardProps {
  dataSource: DataSource;
  manifest: DriverManifest | undefined;
}

export function DataSourceCard({ dataSource, manifest }: DataSourceCardProps) {
  const t = useTranslations("dataSources");
  const { logEvent } = useLogUserJourneyEvent();
  const {
    syncingIds,
    syncDataSourceById,
    toggleCron,
    removeDataSource,
  } = useDataSources();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteData, setDeleteData] = useState(true);
  const [resyncOpen, setResyncOpen] = useState(false);

  const isSyncing = syncingIds.has(dataSource.id);
  const accentColor = manifest?.color ?? "#10b981";
  const supportsAutoSync = manifest?.supportsAutoSync !== false;
  const requiresInputOnSync = manifest?.requiresInputOnSync === true;
  const ResyncDialog = manifest
    ? RESYNC_DIALOG_BY_TYPE[manifest.setupType]
    : null;

  const handleSync = async () => {
    logEvent({
      eventType: "data_sources_sync_button_clicked",
      eventData: {
        dataSourceId: dataSource.id,
        driverType: dataSource.driverType,
        requiresInput: requiresInputOnSync,
      },
    });
    if (requiresInputOnSync && ResyncDialog) {
      logEvent({
        eventType: "data_sources_resync_dialog_opened",
        eventData: {
          dataSourceId: dataSource.id,
          driverType: dataSource.driverType,
          setupType: manifest?.setupType ?? null,
        },
      });
      setResyncOpen(true);
      return;
    }
    await syncDataSourceById(dataSource.id);
  };

  const handleToggleCron = async (checked: boolean) => {
    logEvent({
      eventType: "data_sources_auto_sync_toggle_clicked",
      eventData: {
        dataSourceId: dataSource.id,
        driverType: dataSource.driverType,
        enabled: checked,
      },
    });
    try {
      await toggleCron(dataSource.id, checked);
      logEvent({
        eventType: "data_sources_auto_sync_toggle_success",
        eventData: {
          dataSourceId: dataSource.id,
          driverType: dataSource.driverType,
          enabled: checked,
        },
      });
    } catch {
      logEvent({
        eventType: "data_sources_auto_sync_toggle_error",
        eventData: {
          dataSourceId: dataSource.id,
          driverType: dataSource.driverType,
          enabled: checked,
        },
      });
    }
  };

  const handleDelete = async () => {
    logEvent({
      eventType: "data_sources_delete_confirmed",
      eventData: {
        dataSourceId: dataSource.id,
        driverType: dataSource.driverType,
        deleteData,
      },
    });
    await removeDataSource(dataSource.id, deleteData);
    setConfirmDelete(false);
    setDeleteData(true);
  };

  const openDocument = () => {
    if (dataSource.documentId) {
      logEvent({
        eventType: "data_sources_open_document_clicked",
        eventData: {
          dataSourceId: dataSource.id,
          driverType: dataSource.driverType,
          documentId: dataSource.documentId,
        },
      });
      window.open(
        `/document/${dataSource.documentId}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors"
      data-testid={`data-source-card-${dataSource.id}`}
    >
      <div
        className="flex items-start justify-between gap-3"
        data-testid={`data-source-card-header-${dataSource.id}`}
      >
        <div
          className="flex items-center gap-3 min-w-0 flex-1"
          data-testid={`data-source-card-title-row-${dataSource.id}`}
        >
          <div
            className="rounded-md p-2 flex-shrink-0"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            data-testid={`data-source-icon-${dataSource.id}`}
          >
            <Database className="w-5 h-5" />
          </div>
          <div
            className="min-w-0 flex-1"
            data-testid={`data-source-title-content-${dataSource.id}`}
          >
            <h3
              className="font-semibold text-foreground truncate"
              data-testid={`data-source-name-${dataSource.id}`}
            >
              {dataSource.name}
            </h3>
            <p
              className="text-xs text-muted-foreground truncate"
              data-testid={`data-source-driver-${dataSource.id}`}
            >
              {manifest?.displayName ?? dataSource.driverType}
            </p>
          </div>
        </div>
        <DataSourceStatusBadge status={dataSource.status} />
      </div>

      <div
        className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"
        data-testid={`data-source-metadata-${dataSource.id}`}
      >
        <div data-testid={`data-source-last-sync-${dataSource.id}`}>
          <span className="block text-[10px] uppercase tracking-wider">
            {t("lastSync")}
          </span>
          <span className="text-foreground">
            {dataSource.lastSyncAt
              ? formatDate(dataSource.lastSyncAt)
              : t("never")}
          </span>
        </div>
        <div data-testid={`data-source-doc-type-${dataSource.id}`}>
          <span className="block text-[10px] uppercase tracking-wider">
            {t("docType")}
          </span>
          <span className="text-foreground truncate block">
            {dataSource.docType ?? "-"}
          </span>
        </div>
      </div>

      {dataSource.lastSyncError && (
        <div
          className="text-xs bg-destructive/10 text-destructive p-2 rounded border border-destructive/20"
          data-testid={`data-source-error-${dataSource.id}`}
        >
          {dataSource.lastSyncError}
        </div>
      )}

      {supportsAutoSync && (
        <div
          className="flex items-center justify-between pt-2 border-t border-border"
          data-testid={`data-source-sync-settings-${dataSource.id}`}
        >
          <div
            className="flex items-center gap-2"
            data-testid={`data-source-cron-control-${dataSource.id}`}
          >
            <Switch
              checked={dataSource.cronEnabled}
              onCheckedChange={handleToggleCron}
              data-testid={`data-source-cron-toggle-${dataSource.id}`}
            />
            <span className="text-xs text-muted-foreground">
              {t("dailySync")}
            </span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {dataSource.cronEnabled ? t("autoEnabled") : t("manualOnly")}
          </Badge>
        </div>
      )}

      <div
        className="flex items-center gap-2 flex-wrap"
        data-testid={`data-source-card-actions-${dataSource.id}`}
      >
        <Button
          size="sm"
          variant="default"
          onClick={handleSync}
          disabled={isSyncing}
          data-testid={`data-source-sync-btn-${dataSource.id}`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`}
          />
          {isSyncing ? t("syncing") : t("syncNow")}
        </Button>
        {dataSource.documentId && (
          <Button
            size="sm"
            variant="outline"
            onClick={openDocument}
            data-testid={`data-source-open-doc-btn-${dataSource.id}`}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {t("openDocument")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-destructive hover:text-destructive"
          onClick={() => {
            logEvent({
              eventType: "data_sources_delete_dialog_opened",
              eventData: {
                dataSourceId: dataSource.id,
                driverType: dataSource.driverType,
              },
            });
            setConfirmDelete(true);
          }}
          data-testid={`data-source-delete-btn-${dataSource.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open) {
            logEvent({
              eventType: "data_sources_delete_dialog_closed",
              eventData: {
                dataSourceId: dataSource.id,
                driverType: dataSource.driverType,
              },
            });
          }
          setConfirmDelete(open);
          if (!open) setDeleteData(true);
        }}
      >
        <AlertDialogContent
          data-testid={`data-source-delete-dialog-${dataSource.id}`}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteDescription", { name: dataSource.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className="flex items-center gap-2 py-2"
            data-testid={`data-source-delete-data-checkbox-${dataSource.id}`}
          >
            <Checkbox
              id={`delete-data-${dataSource.id}`}
              checked={deleteData}
              onCheckedChange={(checked) => {
                const nextDeleteData = checked === true;
                logEvent({
                  eventType: "data_sources_delete_data_option_changed",
                  eventData: {
                    dataSourceId: dataSource.id,
                    driverType: dataSource.driverType,
                    deleteData: nextDeleteData,
                  },
                });
                setDeleteData(nextDeleteData);
              }}
            />
            <label
              htmlFor={`delete-data-${dataSource.id}`}
              className="text-sm text-foreground cursor-pointer select-none"
            >
              {t("deleteDataCheckbox")}
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`data-source-delete-cancel-${dataSource.id}`}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`data-source-delete-confirm-${dataSource.id}`}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {requiresInputOnSync && ResyncDialog && manifest && (
        <ResyncDialog
          dataSource={dataSource}
          driver={manifest}
          open={resyncOpen}
          onClose={() => {
            logEvent({
              eventType: "data_sources_resync_dialog_closed",
              eventData: {
                dataSourceId: dataSource.id,
                driverType: dataSource.driverType,
                setupType: manifest.setupType,
              },
            });
            setResyncOpen(false);
          }}
        />
      )}
    </div>
  );
}
