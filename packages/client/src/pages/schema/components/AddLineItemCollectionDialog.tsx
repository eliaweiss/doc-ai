"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface AddLineItemCollectionDialogProps {
  open: boolean;
  onClose: () => void;
}

function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function toUpperSnakeCase(str: string): string {
  return toSnakeCase(str).toUpperCase();
}

export function AddLineItemCollectionDialog({
  open,
  onClose,
}: AddLineItemCollectionDialogProps) {
  const t = useTranslations("schema");
  const { addLineItemCollection } = useSchemaPage();
  const [isSaving, setIsSaving] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();

  const [displayName, setDisplayName] = useState("");
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!keyManuallyEdited) {
      setKey(toSnakeCase(value));
    }
    if (!nameManuallyEdited) {
      setName(toUpperSnakeCase(value));
    }
  };

  const handleKeyChange = (value: string) => {
    setKey(toSnakeCase(value));
    setKeyManuallyEdited(true);
  };

  const handleNameChange = (value: string) => {
    setName(toUpperSnakeCase(value));
    setNameManuallyEdited(true);
  };

  const resetForm = () => {
    setDisplayName("");
    setKey("");
    setName("");
    setDescription("");
    setKeyManuallyEdited(false);
    setNameManuallyEdited(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!key.trim() || !name.trim() || !displayName.trim()) return;

    setIsSaving(true);
    try {
      await addLineItemCollection(key.trim(), {
        name: name.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
      });
      logEvent({
        eventType: "schema_collection_added",
        eventData: {
          collectionKey: key.trim(),
          collectionName: name.trim(),
          collectionDisplayName: displayName.trim(),
        },
      });
      handleClose();
    } catch (err) {
      // Error handled by provider
    } finally {
      setIsSaving(false);
    }
  };

  const isValid =
    key.trim().length > 0 &&
    name.trim().length > 0 &&
    displayName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md" data-testid="add-collection-dialog">
        <DialogHeader>
          <DialogTitle>{t("addLineItemCollection")}</DialogTitle>
          <DialogDescription>
            {t("addLineItemCollectionDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">{t("collectionDisplayName")}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder={t("collectionDisplayNamePlaceholder")}
              data-testid="add-collection-display-name"
            />
          </div>

          {/* Collection Key */}
          <div className="space-y-2">
            <Label htmlFor="key">{t("collectionKey")}</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={t("collectionKeyPlaceholder")}
              className="font-mono"
              data-testid="add-collection-key"
            />
            <p className="text-xs text-muted-foreground">
              {t("collectionKeyHint")}
            </p>
          </div>

          {/* Technical Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("collectionName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t("collectionNamePlaceholder")}
              className="font-mono"
              data-testid="add-collection-name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("collectionDescriptionPlaceholder")}
              rows={2}
              data-testid="add-collection-description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                {t("saving")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {t("addLineItemCollectionButton")}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

