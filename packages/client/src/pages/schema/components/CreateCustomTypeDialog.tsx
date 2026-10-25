"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@zdocs/client-component";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface CreateCustomTypeDialogProps {
  open: boolean;
  onClose: () => void;
}

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function CreateCustomTypeDialog({
  open,
  onClose,
}: CreateCustomTypeDialogProps) {
  const t = useTranslations("schema");
  const { addCustomSchema } = useSchemaPage();
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!nameManuallyEdited) {
      setName(toSnakeCase(value));
    }
  };

  const handleNameChange = (value: string) => {
    setName(toSnakeCase(value));
    setNameManuallyEdited(true);
  };

  const resetForm = () => {
    setDisplayName("");
    setName("");
    setNameManuallyEdited(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim() || !displayName.trim()) return;

    setIsCreating(true);
    try {
      await addCustomSchema({
        name: name.trim(),
        displayName: displayName.trim(),
        headerSchema: [],
      });
      logEvent({
        eventType: "schema_custom_created",
        eventData: {
          name: name.trim(),
          displayName: displayName.trim(),
        },
      });
      handleClose();
    } catch (err) {
      console.error("Failed to create custom type:", err);
      // Error handled by provider
    } finally {
      setIsCreating(false);
    }
  };

  const isValid = name.trim().length > 0 && displayName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="create-custom-type-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("createCustomType")}</DialogTitle>
          <DialogDescription>
            {t("createCustomTypeDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2" data-testid="create-custom-type-form">
          <div className="grid grid-cols-2 gap-4" data-testid="create-custom-type-names-row">
            <div className="space-y-2" data-testid="create-custom-type-display-name">
              <Label htmlFor="displayName">{t("displayName")}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder={t("customTypeDisplayNamePlaceholder")}
                disabled={isCreating}
                data-testid="custom-type-display-name-input"
              />
            </div>

            <div className="space-y-2" data-testid="create-custom-type-technical-name">
              <Label htmlFor="technicalName">{t("technicalName")}</Label>
              <Input
                id="technicalName"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("customTypeTechnicalNamePlaceholder")}
                disabled={isCreating}
                data-testid="custom-type-technical-name-input"
              />
              <p className="text-xs text-muted-foreground">
                {t("technicalNameHint")}
              </p>
            </div>
          </div>
        </div>

        <div
          className="flex justify-end gap-2 pt-4 border-t border-border"
          data-testid="create-custom-type-footer"
        >
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating}
            data-testid="cancel-create-custom-type"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || isCreating}
            data-testid="confirm-create-custom-type"
          >
            {isCreating ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full mr-2" />
                {t("creating")}
              </>
            ) : (
              t("create")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

