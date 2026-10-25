"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, PenLine, Sparkles, Code2 } from "lucide-react";
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
import { FieldDefinition } from "@zdocs/types";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface AddFieldDialogProps {
  open: boolean;
  onClose: () => void;
  collectionKey?: string;
  onFieldCreated?: (field: FieldDefinition, collectionKey?: string) => void;
}

type FieldCreationType = "manual" | "aiExtracted" | "formula";

function toCamelCase(str: string): string {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}

export function AddFieldDialog({
  open,
  onClose,
  collectionKey,
  onFieldCreated,
}: AddFieldDialogProps) {
  const t = useTranslations("schema");
  const { addField } = useSchemaPage();
  const [isSaving, setIsSaving] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();

  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [fieldCreationType, setFieldCreationType] = useState<FieldCreationType | null>(null);
  const [description, setDescription] = useState("");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!nameManuallyEdited) {
      setName(toCamelCase(value));
    }
  };

  const handleNameChange = (value: string) => {
    setName(toCamelCase(value));
    setNameManuallyEdited(true);
  };

  const resetForm = () => {
    setDisplayName("");
    setName("");
    setFieldCreationType(null);
    setDescription("");
    setNameManuallyEdited(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim() || !fieldCreationType) return;

    setIsSaving(true);
    try {
      const newField: FieldDefinition = {
        name: name.trim(),
        displayName: displayName.trim(),
        type: fieldCreationType === "formula" ? "code" : "text",
        description: description.trim() || undefined,
        ...(fieldCreationType === "manual" && { aiExtractable: false }),
      };

      await addField(collectionKey, newField);
      logEvent({
        eventType: "schema_field_added",
        eventData: {
          fieldName: newField.name,
          fieldDisplayName: newField.displayName,
          fieldType: newField.type,
          creationType: fieldCreationType,
          collectionKey,
        },
      });
      handleClose();
      onFieldCreated?.(newField, collectionKey);
    } catch (err) {
      // Error handled by provider
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = name.trim().length > 0 && displayName.trim().length > 0 && fieldCreationType !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="add-field-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("addField")}</DialogTitle>
          <DialogDescription>{t("addFieldDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">{t("displayName")}</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder={t("displayNamePlaceholder")}
              data-testid="add-field-display-name"
            />
          </div>

          {/* Technical Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("technicalName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t("technicalNamePlaceholder")}
              className="font-mono"
              data-testid="add-field-name"
            />
            <p className="text-xs text-muted-foreground">
              {t("technicalNameHint")}
            </p>
          </div>

          {/* Field Creation Type */}
          <div className="space-y-2">
            <Label>{t("fieldType")}</Label>
            <div className="grid grid-cols-3 gap-3" data-testid="add-field-type-selector">
              {([
                { id: "manual" as const, icon: PenLine, label: t("manual"), desc: t("manualExplanation") },
                { id: "aiExtracted" as const, icon: Sparkles, label: t("aiExtracted"), desc: t("aiExtractedExplanation") },
                { id: "formula" as const, icon: Code2, label: t("formula"), desc: t("formulaExplanation") },
              ]).map(({ id, icon: Icon, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFieldCreationType(id);
                    logEvent({
                      eventType: "schema_field_type_selected",
                      eventData: { type: id, collectionKey },
                    });
                  }}
                  className={`flex flex-col items-center text-center gap-2 rounded-lg border p-4 cursor-pointer transition-colors ${
                    fieldCreationType === id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                  data-testid={`add-field-type-${id}`}
                >
                  <Icon className={`h-6 w-6 ${fieldCreationType === id ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={2}
              data-testid="add-field-description"
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
                {t("addFieldButton")}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

