"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import type { DataSource, DriverManifest } from "@zdocs/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
} from "@zdocs/client-component";
import { FilePicker } from "../../../components/ui/file-picker/FilePicker";
import { useDataSources } from "../context/DataSourcesProvider";
import { fetchDriverSetupConfig } from "../../../utilities/api/dataSourceApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

const DEFAULT_ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
  "application/vnd.ms-excel": [".xls"],
};

interface FileDatasetSyncDialogProps {
  dataSource: DataSource;
  driver: DriverManifest;
  open: boolean;
  onClose: () => void;
}

/**
 * Re-upload dialog for the file_upload setup type. Replaces all existing
 * dataset rows with the contents of the new file. The transform from the
 * original setup is reused (no AI re-parse).
 *
 * Pulls the accepted file types from the driver's `getSetupConfig` so any
 * future file_upload driver can configure them without code changes here.
 */
export function FileDatasetSyncDialog({
  dataSource,
  driver,
  open,
  onClose,
}: FileDatasetSyncDialogProps) {
  const t = useTranslations("dataSources");
  const { orgId, syncWithInputById } = useDataSources();
  const { logEvent } = useLogUserJourneyEvent();

  const [acceptedFileTypes, setAcceptedFileTypes] = useState<
    Record<string, string[]>
  >(DEFAULT_ACCEPTED_FILE_TYPES);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsUploading(false);
      setIsSyncing(false);
      return;
    }

    logEvent({
      eventType: "data_sources_file_resync_dialog_viewed",
      eventData: {
        dataSourceId: dataSource.id,
        driverType: dataSource.driverType,
      },
    });
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDriverSetupConfig(orgId, driver.driverType);
        if (cancelled) return;
        const opts = (res.setupConfig.options ?? {}) as {
          acceptedFileTypes?: Record<string, string[]>;
        };
        setAcceptedFileTypes(
          opts.acceptedFileTypes ?? DEFAULT_ACCEPTED_FILE_TYPES
        );
        logEvent({
          eventType: "data_sources_file_resync_config_loaded",
          eventData: {
            dataSourceId: dataSource.id,
            driverType: dataSource.driverType,
            acceptedMimeTypes: Object.keys(
              opts.acceptedFileTypes ?? DEFAULT_ACCEPTED_FILE_TYPES
            ),
          },
        });
      } catch (err) {
        logEvent({
          eventType: "data_sources_file_resync_config_error",
          eventData: {
            dataSourceId: dataSource.id,
            driverType: dataSource.driverType,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        console.warn("Failed to load file driver setup config", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orgId, driver.driverType, dataSource.id, dataSource.driverType, logEvent]);

  const handleFileUploaded = async (
    _url: string,
    _file: File,
    options?: { documentId?: string }
  ) => {
    if (!options?.documentId) {
      logEvent({
        eventType: "data_sources_file_resync_upload_error",
        eventData: {
          dataSourceId: dataSource.id,
          driverType: dataSource.driverType,
          reason: "missing_document_id",
        },
      });
      return;
    }
    logEvent({
      eventType: "data_sources_file_resync_file_uploaded",
      eventData: {
        dataSourceId: dataSource.id,
        driverType: dataSource.driverType,
        sourceDocumentId: options.documentId,
      },
    });
    setIsSyncing(true);
    const ok = await syncWithInputById(dataSource.id, {
      sourceDocumentId: options.documentId,
    });
    setIsSyncing(false);
    logEvent({
      eventType: ok
        ? "data_sources_file_resync_success"
        : "data_sources_file_resync_error",
      eventData: {
        dataSourceId: dataSource.id,
        driverType: dataSource.driverType,
        sourceDocumentId: options.documentId,
      },
    });
    if (ok) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isSyncing && onClose()}>
      <DialogContent
        className="max-w-md"
        data-testid="file-dataset-sync-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("reuploadTitle")}</DialogTitle>
          <DialogDescription>
            {t("reuploadDescription", { name: dataSource.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Label className="mb-2 block">{t("reuploadConfirmTitle")}</Label>
          <FilePicker
            acceptedFileTypes={acceptedFileTypes}
            isLoading={isUploading || isSyncing}
            setIsLoading={setIsUploading}
            onSave={handleFileUploaded}
            uploadOptions={{ processingMode: "DATA_SOURCE_FILE" }}
            dragAreaText={{
              title: t("fileUploadDragTitle"),
              action: t("fileUploadDragAction"),
              editAction: t("fileUploadEditAction"),
            }}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t("fileUploadHint")}
          </p>

          {(isUploading || isSyncing) && (
            <div
              className="flex items-center gap-2 mt-3 text-sm text-muted-foreground"
              data-testid="file-dataset-sync-status"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              {isSyncing ? t("parsingFile") : t("uploadingFile")}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSyncing}
            data-testid="file-dataset-sync-cancel"
          >
            {t("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
