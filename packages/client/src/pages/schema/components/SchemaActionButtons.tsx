"use client";

import { useState } from "react";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import { downloadPortableSchema } from "../utils/portableSchema";
import { UploadSchemaDialog } from "./UploadSchemaDialog";

export function SchemaActionButtons() {
  const t = useTranslations("schema");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const {
    selectedSchema,
    hasUnsavedChanges,
    isSaving,
    isDeleting,
    handleSave,
    handleCancel,
    handleDeleteSchema,
    // showHidden and setShowHidden kept for future use - button removed but functionality preserved
  } = useSchemaPage();
  const { logEvent } = useLogUserJourneyEvent();

  const handleSaveClick = async () => {
    await handleSave();
    logEvent({
      eventType: "schema_saved",
      eventData: {
        schemaId: selectedSchema?.id,
        schemaName: selectedSchema?.name,
      },
    });
  };

  const handleCancelClick = () => {
    handleCancel();
    logEvent({
      eventType: "schema_canceled",
      eventData: {
        schemaId: selectedSchema?.id,
        schemaName: selectedSchema?.name,
      },
    });
  };

  const handleDownloadClick = () => {
    if (!selectedSchema) return;
    downloadPortableSchema(selectedSchema);
  };

  const handleUploadClick = () => {
    setShowUploadDialog(true);
    logEvent({
      eventType: "schema_upload_dialog_opened",
      eventData: {
        schemaId: selectedSchema?.id,
        schemaName: selectedSchema?.name,
      },
    });
  };

  return (
    <div className="flex items-center gap-2" data-testid="schema-action-buttons">
      {/* Show Hidden Fields button removed - hidden fields now always visible */}
      {/* To restore: uncomment button below and set showHidden default to false in SchemaPageProvider */}
      {/* 
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowHidden(!showHidden)}
        className="flex items-center gap-2"
        data-testid="show-hidden-fields-button"
      >
        {showHidden ? (
          <>
            <EyeOff className="w-4 h-4" />
            {t("hideHiddenFields")}
          </>
        ) : (
          <>
            <Eye className="w-4 h-4" />
            {t("showHiddenFields")}
          </>
        )}
      </Button>
      */}

      {hasUnsavedChanges ? (
        <div
          className="flex items-center gap-2"
          data-testid="schema-save-bar"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelClick}
            disabled={isSaving}
            className="flex items-center gap-2"
            data-testid="schema-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveClick}
            disabled={isSaving}
            className="flex items-center gap-2"
            data-testid="schema-save-btn"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            disabled={isSaving}
            className="flex items-center gap-2"
            data-testid="upload-current-schema-button"
          >
            <Upload className="w-4 h-4" />
            {t("uploadSchema")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadClick}
            disabled={isSaving}
            className="flex items-center gap-2"
            data-testid="download-schema-button"
          >
            <Download className="w-4 h-4" />
            {t("downloadSchema")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              await handleDeleteSchema();
              logEvent({
                eventType: "schema_deleted",
                eventData: {
                  schemaId: selectedSchema?.id,
                  schemaName: selectedSchema?.name,
                },
              });
            }}
          disabled={isDeleting || isSaving}
          className="flex items-center gap-2"
          data-testid="delete-schema-button"
        >
          {isDeleting ? (
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          {t("deleteSchema")}
        </Button>
          <UploadSchemaDialog
            open={showUploadDialog}
            onClose={() => setShowUploadDialog(false)}
          />
        </>
      )}
    </div>
  );
}

