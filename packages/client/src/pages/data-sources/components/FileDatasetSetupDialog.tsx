"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, AlertCircle } from "lucide-react";
import type { DriverManifest, FieldDefinition } from "@zdocs/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
} from "@zdocs/client-component";
import { FilePicker } from "../../../components/ui/file-picker/FilePicker";
import { useDataSources } from "../context/DataSourcesProvider";
import {
  fetchDriverSetupConfig,
  previewDatasetFile,
  type DatasetPreviewResponse,
} from "../../../utilities/api/dataSourceApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

const DEFAULT_ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
  "application/vnd.ms-excel": [".xls"],
};

interface FileDatasetSetupDialogProps {
  driver: DriverManifest;
  open: boolean;
  onClose: () => void;
}

type Step = "upload" | "analyzing" | "preview" | "creating" | "error";

export function FileDatasetSetupDialog({
  driver,
  open,
  onClose,
}: FileDatasetSetupDialogProps) {
  const t = useTranslations("dataSources");
  const { orgId, createNewDataSource } = useDataSources();
  const { logEvent } = useLogUserJourneyEvent();

  const [step, setStep] = useState<Step>("upload");
  const [acceptedFileTypes, setAcceptedFileTypes] = useState<
    Record<string, string[]>
  >(DEFAULT_ACCEPTED_FILE_TYPES);
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("upload");
      setSourceDocumentId(null);
      setPreview(null);
      setDatasetName("");
      setError(null);
      setIsUploading(false);
      return;
    }

    logEvent({
      eventType: "data_sources_file_setup_dialog_opened",
      eventData: { driverType: driver.driverType },
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
          eventType: "data_sources_file_setup_config_loaded",
          eventData: {
            driverType: driver.driverType,
            acceptedMimeTypes: Object.keys(
              opts.acceptedFileTypes ?? DEFAULT_ACCEPTED_FILE_TYPES
            ),
          },
        });
      } catch (err) {
        logEvent({
          eventType: "data_sources_file_setup_config_error",
          eventData: {
            driverType: driver.driverType,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        console.warn("Failed to load file driver setup config", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orgId, driver.driverType, logEvent]);

  const handleFileUploaded = async (
    _url: string,
    _file: File,
    options?: { documentId?: string }
  ) => {
    if (!options?.documentId) {
      logEvent({
        eventType: "data_sources_file_upload_error",
        eventData: { driverType: driver.driverType, reason: "missing_document_id" },
      });
      setError("Upload completed but no documentId was returned");
      setStep("error");
      return;
    }
    const docId = options.documentId;
    logEvent({
      eventType: "data_sources_file_uploaded",
      eventData: { driverType: driver.driverType, documentId: docId },
    });
    setSourceDocumentId(docId);
    setStep("analyzing");
    setError(null);

    try {
      logEvent({
        eventType: "data_sources_file_preview_requested",
        eventData: { driverType: driver.driverType, documentId: docId },
      });
      const result = await previewDatasetFile(orgId, docId);
      setPreview(result);
      setDatasetName(
        result.suggestions.matchedTypeName ||
        result.suggestions.datasetName ||
        ""
      );
      logEvent({
        eventType: "data_sources_file_preview_success",
        eventData: {
          driverType: driver.driverType,
          documentId: docId,
          rowCount: result.preview.rowCount,
          previewRowCount: result.preview.rows.length,
          fieldCount: result.preview.schema.length,
          suggestedDatasetName: result.suggestions.datasetName,
        },
      });
      setStep("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyze file";
      logEvent({
        eventType: "data_sources_file_preview_error",
        eventData: {
          driverType: driver.driverType,
          documentId: docId,
          errorType: err instanceof Error ? err.name : "unknown",
        },
      });
      setError(msg);
      setStep("error");
    }
  };

  const handleConfirm = async () => {
    if (!sourceDocumentId || !preview) return;
    const trimmedName = datasetName.trim();
    if (!trimmedName) return;

    setStep("creating");
    setError(null);
    logEvent({
      eventType: "data_sources_file_create_confirmed",
      eventData: {
        driverType: driver.driverType,
        documentId: sourceDocumentId,
        fieldCount: preview.preview.schema.length,
        rowCount: preview.preview.rowCount,
        hasDatasetName: trimmedName.length > 0,
      },
    });

    const created = await createNewDataSource(driver.driverType, {
      sourceDocumentId,
      confirmedSchema: preview.preview.schema,
      transform: preview.preview.transform,
      datasetName: trimmedName,
    });

    if (created) {
      logEvent({
        eventType: "data_sources_file_create_success",
        eventData: {
          driverType: driver.driverType,
          dataSourceId: created.id,
          documentId: sourceDocumentId,
        },
      });
      onClose();
    } else {
      logEvent({
        eventType: "data_sources_file_create_error",
        eventData: {
          driverType: driver.driverType,
          documentId: sourceDocumentId,
        },
      });
      setStep("preview");
    }
  };

  const handleRetry = () => {
    logEvent({
      eventType: "data_sources_file_setup_retry_clicked",
      eventData: { driverType: driver.driverType, fromStep: step },
    });
    setStep("upload");
    setError(null);
    setSourceDocumentId(null);
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        data-testid="file-dataset-setup-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("fileDatasetTitle")}</DialogTitle>
          <DialogDescription>{t("fileDatasetDescription")}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-2" data-testid="file-dataset-upload-step">
            <Label className="mb-2 block">{t("fileUploadStep")}</Label>
            <FilePicker
              acceptedFileTypes={acceptedFileTypes}
              isLoading={isUploading}
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
            {isUploading && (
              <div
                className="flex items-center gap-2 mt-3 text-sm text-muted-foreground"
                data-testid="file-dataset-uploading"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("uploadingFile")}
              </div>
            )}
          </div>
        )}

        {step === "analyzing" && (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            data-testid="file-dataset-analyzing"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t("analyzingFile")}
            </p>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="py-2 space-y-4" data-testid="file-dataset-preview-step">
            <div>
              <Label htmlFor="dataset-name" className="mb-1 block">
                {t("datasetNameLabel")}
              </Label>
              <Input
                id="dataset-name"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder={t("datasetNamePlaceholder")}
                data-testid="file-dataset-name-input"
              />
            </div>

            <div data-testid="file-dataset-schema-section">
              <div className="flex items-baseline justify-between mb-2">
                <Label>{t("schemaPreviewTitle")}</Label>
                <span className="text-xs text-muted-foreground">
                  {t("schemaPreviewSubtitle", {
                    count: preview.preview.schema.length,
                  })}
                </span>
              </div>
              <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("fieldDisplayName")}</TableHead>
                      <TableHead>{t("fieldName")}</TableHead>
                      <TableHead className="w-24">{t("fieldType")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.schema.map((field: FieldDefinition) => (
                      <TableRow
                        key={field.name}
                        data-testid={`file-dataset-field-${field.name}`}
                      >
                        <TableCell className="font-medium">
                          {field.displayName}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {field.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div data-testid="file-dataset-sample-section">
              <div className="flex items-baseline justify-between mb-2">
                <Label>{t("sampleDataTitle")}</Label>
                <span className="text-xs text-muted-foreground">
                  {t("sampleDataSubtitle", {
                    count: preview.preview.rows.length,
                    total: preview.preview.rowCount,
                  })}
                </span>
              </div>
              <div className="border border-border rounded-md max-h-56 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.preview.schema.map((field) => (
                        <TableHead
                          key={field.name}
                          className="whitespace-nowrap text-xs"
                        >
                          {field.displayName}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.rows.map((row, rowIdx) => (
                      <TableRow
                        key={rowIdx}
                        data-testid={`file-dataset-sample-row-${rowIdx}`}
                      >
                        {preview.preview.schema.map((field) => (
                          <TableCell
                            key={field.name}
                            className="whitespace-nowrap text-xs"
                          >
                            {formatCell(row[field.name])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {step === "creating" && (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            data-testid="file-dataset-creating"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("creatingStep")}</p>
          </div>
        )}

        {step === "error" && (
          <div
            className="py-6 flex flex-col items-center text-center gap-3"
            data-testid="file-dataset-error"
          >
            <AlertCircle className="w-8 h-8 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">
                {t("fileSetupErrorTitle")}
              </p>
              {error && (
                <p className="text-sm text-destructive mt-1">{error}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={handleRetry}
                data-testid="file-dataset-cancel"
              >
                {t("fileSetupRetry")}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!datasetName.trim()}
                data-testid="file-dataset-confirm"
              >
                {t("confirmAndCreate")}
              </Button>
            </>
          )}
          {step === "error" && (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="file-dataset-error-close"
              >
                {t("close")}
              </Button>
              <Button
                onClick={handleRetry}
                data-testid="file-dataset-error-retry"
              >
                {t("fileSetupRetry")}
              </Button>
            </>
          )}
          {step === "upload" && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
              data-testid="file-dataset-upload-cancel"
            >
              {t("cancel")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
