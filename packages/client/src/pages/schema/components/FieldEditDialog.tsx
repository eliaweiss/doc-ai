"use client";

import { useTranslations } from "next-intl";
import { Pencil, Save, Trash2 } from "lucide-react";
import { Button } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import { FieldDefinition } from "@zdocs/types";
import {
  FieldEditDialogProvider,
  useFieldEditDialog,
} from "./FieldEditDialog/FieldEditDialogProvider";
import { useConfirm } from "../../../context-providers/confirm-provider/ConfirmProvider";
import { FieldEditDialogSidebar } from "./FieldEditDialog/FieldEditDialogSidebar";
import { FieldEditDialogContentArea } from "./FieldEditDialog/FieldEditDialogContentArea";
import { useState } from "react";

interface FieldEditDialogProps {
  editingField: {
    field: FieldDefinition;
    collectionKey?: string;
  } | null;
  onClose: () => void;
}

function FieldEditDialogContent() {
  const {
    formData,
    editingField,
    isSaving,
    isDeleting,
    handleSave,
    handleDelete,
    onClose,
    showDialogFooter
  } = useFieldEditDialog();
  const t = useTranslations("schema");
  const confirm = useConfirm();

  const onDeleteClick = async () => {
    const fieldName =
      editingField?.field.displayName || editingField?.field.name || "";
    const confirmed = await confirm({
      title: t("deleteFieldTitle"),
      message: t("deleteFieldConfirmation", { name: fieldName }),
      confirmLabel: t("deleteField"),
      cancelLabel: t("cancel"),
    });
    if (confirmed) {
      await handleDelete();
    }
  };

  return (
    <>
      <DialogHeader className="p-6 pb-2 flex-shrink-0">
        <DialogTitle>
          <div className="flex items-center gap-2"
            data-testid="field-edit-dialog-title"
          >
            <Pencil className="w-4 h-4" />
            <span className="">{editingField?.field.displayName || editingField?.field.name || ""}</span>
            <span className="text-sm text-muted-foreground">{t("editField")}</span>
          </div>
        </DialogTitle>
      </DialogHeader>

      {formData && (
        <div className="flex flex-1 overflow-hidden" data-testid="field-edit-dialog-content">
          <FieldEditDialogSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <FieldEditDialogContentArea />
          </div>
        </div>
      )}
      {showDialogFooter && (
        <DialogFooter className="p-6 py-2 border-t border-border flex items-center justify-between flex-shrink-0">

          <div className="flex items-center justify-between w-full" data-testid="field-edit-dialog-footer">

            <Button
              variant="destructive"
              onClick={onDeleteClick}
              disabled={isSaving || isDeleting}
              data-testid="delete-field-button"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  {t("deleting")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  {t("deleteField")}
                </span>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSaving || isDeleting}
              >
                {t("cancel")}
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isDeleting}>
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    {t("saving")}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {t("save")}
                  </span>
                )}
              </Button>
            </div>
          </div>

        </DialogFooter>)}
    </>
  );
}

export function FieldEditDialog({
  editingField,
  onClose,
}: FieldEditDialogProps) {
  return (
    <Dialog open={!!editingField} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex flex-col p-0">
        <FieldEditDialogProvider editingField={editingField} onClose={onClose}>
          <FieldEditDialogContent />
        </FieldEditDialogProvider>
      </DialogContent>
    </Dialog>
  );
}
