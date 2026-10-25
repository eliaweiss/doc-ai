"use client";

import { useFieldEditDialog } from "./FieldEditDialogProvider";
import { useTranslations } from "next-intl";
import { Label } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";

interface FlagItem {
  id: string;
  checked: boolean;
  labelKey: string;
  explanationKey: string;
  onChange: (checked: boolean) => void;
}

export function FlagsSection() {
  const { formData, setFormData } = useFieldEditDialog();
  const t = useTranslations("schema");

  if (!formData) return null;

  const flags: FlagItem[] = [
    {
      id: "hidden",
      checked: formData.hidden ?? false,
      labelKey: "hidden",
      explanationKey: "hiddenExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, hidden: !!checked }),
    },
    {
      id: "isPrimaryKey",
      checked: formData.isPrimaryKey ?? false,
      labelKey: "isPrimaryKey",
      explanationKey: "isPrimaryKeyExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, isPrimaryKey: !!checked }),
    },
    {
      id: "required",
      checked: formData.required ?? false,
      labelKey: "required",
      explanationKey: "requiredExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, required: !!checked }),
    },
    {
      id: "searchable",
      checked: formData.searchable ?? false,
      labelKey: "searchable",
      explanationKey: "searchableExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, searchable: !!checked }),
    },
    {
      id: "isImportant",
      checked: formData.isImportant ?? false,
      labelKey: "isImportant",
      explanationKey: "isImportantExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, isImportant: !!checked }),
    },
    {
      id: "isDescription",
      checked: formData.isDescription ?? false,
      labelKey: "isDescription",
      explanationKey: "isDescriptionExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, isDescription: !!checked }),
    },
    {
      id: "isReconcilable",
      checked: formData.isReconcilable ?? false,
      labelKey: "isReconcilable",
      explanationKey: "isReconcilableExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, isReconcilable: !!checked }),
    },
    {
      id: "isInstitution",
      checked: formData.isInstitution ?? false,
      labelKey: "isInstitution",
      explanationKey: "isInstitutionExplanation",
      onChange: (checked) =>
        setFormData({ ...formData, isInstitution: !!checked }),
    },
  ];

  return (
    <div className="space-y-4">
      {flags.map((flag) => (
        <div
          key={flag.id}
          className="flex items-start space-x-3 py-2 border-b border-border last:border-b-0"
        >
          <Checkbox
            id={flag.id}
            checked={flag.checked}
            onCheckedChange={flag.onChange}
            className="mt-1"
          />
          <div className="flex-1 space-y-1">
            <Label htmlFor={flag.id} className="text-sm font-medium">
              {t(flag.labelKey)}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t(flag.explanationKey) || ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

