"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { FileText, Check, Plus } from "lucide-react";
import { Button } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import { SYSTEM_DOCUMENT_TYPES } from "@zdocs/types";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { CreateCustomTypeDialog } from "./CreateCustomTypeDialog";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface AddSchemaDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddSchemaDialog({ open, onClose }: AddSchemaDialogProps) {
  const t = useTranslations("schema");
  const { documentTypes, addSchemaFromSystem } = useSchemaPage();
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [showCreateCustomDialog, setShowCreateCustomDialog] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();

  // Get available system types that haven't been added yet
  const availableTypes = useMemo(() => {
    const existingNames = new Set(documentTypes.map((dt) => dt.name));
    return SYSTEM_DOCUMENT_TYPES.filter((st) => !existingNames.has(st.name));
  }, [documentTypes]);

  // Check if all types are selected
  const allSelected =
    availableTypes.length > 0 && selectedTypes.size === availableTypes.length;
  const someSelected = selectedTypes.size > 0 && !allSelected;

  const handleToggleType = (typeName: string) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(typeName)) {
        newSet.delete(typeName);
      } else {
        newSet.add(typeName);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(availableTypes.map((t) => t.name)));
    }
  };

  const handleAddSelected = async () => {
    if (selectedTypes.size === 0) return;

    setIsAdding(true);
    try {
      // Add all selected types sequentially
      for (const typeName of selectedTypes) {
        await addSchemaFromSystem(typeName);
        logEvent({
          eventType: "schema_added_from_system",
          eventData: { typeName },
        });
      }
      setSelectedTypes(new Set());
      onClose();
    } catch (err) {
      // Error handled by provider
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedTypes(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="sm:max-w-lg max-h-[80vh] flex flex-col"
        data-testid="add-schema-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("addDocumentType")}</DialogTitle>
          <DialogDescription>
            {t("addDocumentTypeDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4" data-testid="add-schema-content">
          {availableTypes.length === 0 ? (
            <div
              className="text-center py-8 text-muted-foreground"
              data-testid="no-types-available"
            >
              <Check className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">{t("allTypesAdded")}</p>
              <p className="text-sm">{t("allTypesAddedHint")}</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="available-types-list">
              {/* Select All / Deselect All */}
              <div
                className="flex items-center gap-3 pb-2 border-b border-border"
                data-testid="select-all-container"
              >
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  data-testid="select-all-checkbox"
                  className={someSelected ? "data-[state=checked]:bg-primary" : ""}
                  {...(someSelected && { "data-state": "indeterminate" })}
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium cursor-pointer select-none"
                  data-testid="select-all-label"
                >
                  {allSelected ? t("deselectAll") : t("selectAll")}
                  {selectedTypes.size > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({selectedTypes.size}/{availableTypes.length})
                    </span>
                  )}
                </label>
              </div>

              {/* Type List */}
              {availableTypes.map((type) => (
                <label
                  key={type.name}
                  htmlFor={`type-${type.name}`}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer select-none ${
                    selectedTypes.has(type.name)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50"
                  } ${isAdding ? "opacity-50 pointer-events-none" : ""}`}
                  data-testid={`type-option-${type.name}`}
                >
                  <Checkbox
                    id={`type-${type.name}`}
                    checked={selectedTypes.has(type.name)}
                    onCheckedChange={() => handleToggleType(type.name)}
                    disabled={isAdding}
                    data-testid={`type-checkbox-${type.name}`}
                  />
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: type.color, color: "white" }}
                  >
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {type.displayName}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {type.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex justify-between items-center pt-4 border-t border-border"
          data-testid="dialog-footer"
        >
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateCustomDialog(true);
              logEvent({
                eventType: "schema_custom_dialog_opened",
              });
            }}
            disabled={isAdding}
            data-testid="create-custom-type-button"
            className="text-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("createNewType")}
          </Button>
          <div className="flex items-center gap-4">
            {selectedTypes.size > 0 && (
              <span
                className="text-sm text-muted-foreground"
                data-testid="selection-count"
              >
                {t("typesSelected", { count: selectedTypes.size })}
              </span>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isAdding}
                data-testid="cancel-button"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={selectedTypes.size === 0 || isAdding}
                data-testid="add-selected-button"
              >
                {isAdding ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-background border-t-transparent rounded-full mr-2" />
                    {t("adding")}
                  </>
                ) : (
                  t("addSelected")
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <CreateCustomTypeDialog
        open={showCreateCustomDialog}
        onClose={() => {
          setShowCreateCustomDialog(false);
          handleClose();
        }}
      />
    </Dialog>
  );
}

