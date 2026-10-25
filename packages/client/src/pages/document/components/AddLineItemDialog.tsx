"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FieldDefinition } from "@zdocs/types";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import {
  buildEmptyLineItem,
  convertLineItemFieldValue,
  getEditableLineItemFields,
  getLineItemFieldInputType,
  getLineItemFieldStringValue,
  LineItemFormData,
} from "./lineItemActionUtils";

interface AddLineItemDialogProps {
  open: boolean;
  collectionDisplayName: string;
  lineItemSchema: FieldDefinition[];
  isSaving: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onOpenChange: (open: boolean) => void;
  onAdd: (lineItem: Record<string, unknown>) => Promise<void>;
}

export function AddLineItemDialog({
  open,
  collectionDisplayName,
  lineItemSchema,
  isSaving,
  t,
  onOpenChange,
  onAdd,
}: AddLineItemDialogProps) {
  const fields = useMemo(
    () => getEditableLineItemFields(lineItemSchema),
    [lineItemSchema]
  );
  const [formData, setFormData] = useState<LineItemFormData>(() =>
    buildEmptyLineItem(lineItemSchema)
  );

  useEffect(() => {
    if (open) {
      setFormData(buildEmptyLineItem(lineItemSchema));
    }
  }, [lineItemSchema, open]);

  const handleFieldChange = (
    field: FieldDefinition,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field.name]: convertLineItemFieldValue(field, value),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onAdd(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-2xl"
        data-testid="add-line-item-dialog"
      >
        <DialogHeader data-testid="add-line-item-dialog-header">
          <DialogTitle>{t("addLineItemDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("addLineItemDialogDescription", {
              collection: collectionDisplayName,
            })}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={handleSubmit}
          data-testid="add-line-item-form"
        >
          <div
            className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2"
            data-testid="add-line-item-fields"
          >
            {fields.map((field) => (
              <div
                key={field.name}
                className="space-y-2"
                data-testid={`add-line-item-field-${field.name}`}
              >
                <Label htmlFor={`add-line-item-${field.name}`}>
                  {field.displayName || field.name}
                </Label>
                {field.type === "boolean" ? (
                  <div
                    className="flex h-9 items-center gap-2"
                    data-testid={`add-line-item-boolean-${field.name}`}
                  >
                    <Checkbox
                      id={`add-line-item-${field.name}`}
                      checked={Boolean(formData[field.name])}
                      onCheckedChange={(checked) =>
                        handleFieldChange(field, checked === true)
                      }
                      data-testid={`add-line-item-input-${field.name}`}
                    />
                    <span className="text-sm text-muted-foreground">
                      {Boolean(formData[field.name]) ? t("yes") : t("no")}
                    </span>
                  </div>
                ) : field.type === "enum" && field.enumValues?.length ? (
                  <Select
                    value={getLineItemFieldStringValue(formData[field.name])}
                    onValueChange={(value) => handleFieldChange(field, value)}
                  >
                    <SelectTrigger
                      id={`add-line-item-${field.name}`}
                      data-testid={`add-line-item-input-${field.name}`}
                    >
                      <SelectValue placeholder={t("selectOption")} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.enumValues.map((enumValue) => (
                        <SelectItem key={enumValue} value={enumValue}>
                          {enumValue}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`add-line-item-${field.name}`}
                    type={getLineItemFieldInputType(field)}
                    value={getLineItemFieldStringValue(formData[field.name])}
                    onChange={(event) =>
                      handleFieldChange(field, event.target.value)
                    }
                    data-testid={`add-line-item-input-${field.name}`}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter data-testid="add-line-item-dialog-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              data-testid="add-line-item-cancel-btn"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              data-testid="add-line-item-submit-btn"
            >
              {isSaving ? t("savingLineItem") : t("addLineItem")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
