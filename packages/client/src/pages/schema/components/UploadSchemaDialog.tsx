"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import {
  downloadPortableSchema,
  parsePortableSchema,
  type PortableSchema,
} from "../utils/portableSchema";
import { UploadSchemaDropzone } from "./UploadSchemaDropzone";

interface UploadSchemaDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UploadSchemaDialog({ open, onClose }: UploadSchemaDialogProps) {
  const t = useTranslations("schema");
  const { selectedSchema, uploadSchema } = useSchemaPage();
  const { logEvent } = useLogUserJourneyEvent();
  const [fileName, setFileName] = useState<string | null>(null);
  const [portable, setPortable] = useState<PortableSchema | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const schemaName = selectedSchema?.displayName || selectedSchema?.name || "";

  const resetState = () => {
    setFileName(null);
    setPortable(null);
    setIsUploading(false);
  };

  const handleClose = () => {
    if (isUploading) return;
    resetState();
    onClose();
  };

  const handleBackup = () => {
    if (!selectedSchema) return;
    downloadPortableSchema(selectedSchema);
    logEvent({
      eventType: "schema_backup_downloaded",
      eventData: {
        schemaId: selectedSchema.id,
        schemaName: selectedSchema.name,
      },
    });
  };

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const parsed = parsePortableSchema(JSON.parse(await file.text()));
        setPortable(parsed);
        setFileName(file.name);
      } catch {
        setPortable(null);
        setFileName(null);
        toast.error(t("invalidSchemaFile"));
      }
    },
    [t]
  );

  const handleReplace = async () => {
    if (!portable || !selectedSchema) return;
    setIsUploading(true);
    try {
      await uploadSchema(portable);
      logEvent({
        eventType: "schema_uploaded",
        eventData: {
          schemaId: selectedSchema.id,
          schemaName: selectedSchema.name,
          uploadedName: portable.name,
        },
      });
      resetState();
      onClose();
    } catch {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="upload-schema-dialog"
      >
        <DialogHeader data-testid="upload-schema-dialog-header">
          <DialogTitle>{t("uploadOverrideCurrentTitle")}</DialogTitle>
          <DialogDescription>
            {t("uploadOverrideCurrentDescription", { name: schemaName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" data-testid="upload-schema-dialog-body">
          <div
            className="flex gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3"
            data-testid="upload-schema-warning"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div data-testid="upload-schema-warning-text">
              <p className="text-sm text-foreground">
                {t("uploadBackupSuggestion")}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleBackup}
            disabled={isUploading || !selectedSchema}
            className="w-full flex items-center gap-2"
            data-testid="upload-schema-backup-button"
          >
            <Download className="w-4 h-4" />
            {t("downloadBackup")}
          </Button>

          <UploadSchemaDropzone
            fileName={fileName}
            disabled={isUploading}
            onFile={handleFile}
          />
        </div>

        <DialogFooter data-testid="upload-schema-dialog-footer">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
            data-testid="upload-schema-cancel-button"
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleReplace}
            disabled={!portable || isUploading}
            className="flex items-center gap-2"
            data-testid="upload-schema-replace-button"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("replaceSchema")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
