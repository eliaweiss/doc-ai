"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { FolderMapping, TransactionType, TRANSACTION_TYPES } from "@zdocs/types";
import { FolderSelectDialog } from "./FolderSelectDialog";
import { useDocsStore } from "../../../context-providers/docsStore";
import { flattenFolderTree } from "../../drive/functions/folder-tree";

interface FolderMappingEditorProps {
  mappings: FolderMapping[];
  onChange: (mappings: FolderMapping[]) => void;
  onBlur?: () => void;
  onSave?: () => void;
}

export function FolderMappingEditor({
  mappings,
  onChange,
  onBlur,
  onSave,
}: FolderMappingEditorProps) {
  const t = useTranslations("schema");
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const folderTree = useDocsStore((state) => state.folderTree);

  const getFolderName = (folderId: string) => {
    const flattened = flattenFolderTree(folderTree);
    return flattened.find((f) => f.id === folderId)?.name || folderId;
  };

  const handleAddMapping = () => {
    setEditingIndex(null);
    setIsFolderPickerOpen(true);
  };

  const handleFolderSelect = (folderId: string | null) => {
    if (!folderId) return;

    if (editingIndex !== null) {
      const newMappings = [...mappings];
      newMappings[editingIndex] = { ...newMappings[editingIndex], folderId };
      onChange(newMappings);
    } else {
      onChange([
        ...mappings,
        {
          folderId,
          extractionHint: "",
          transactionType: null,
        },
      ]);
    }
    onSave?.();
  };

  const handleUpdateMapping = (
    index: number,
    updates: Partial<FolderMapping>
  ) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onChange(newMappings);
  };

  const handleRemoveMapping = (index: number) => {
    onChange(mappings.filter((_, i) => i !== index));
    onSave?.();
  };

  return (
    <div className="space-y-4" data-testid="folder-mapping-editor">
      <div data-testid="folder-mapping-header">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold text-foreground">
            {t("customRulesTitle")}
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddMapping}
            className="flex items-center gap-2"
            data-testid="add-mapping-btn"
          >
            <Plus className="w-4 h-4" />
            {t("addMapping")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("customRulesDescription")}
        </p>
      </div>

      {mappings.length === 0 ? (
        <div
          className="text-sm text-muted-foreground italic p-4 border border-dashed border-border rounded-lg text-center"
          data-testid="no-mappings-placeholder"
        >
          {t("noFolderMappings")}
        </div>
      ) : (
        <div className="space-y-3" data-testid="mapping-cards-list">
          {mappings.map((mapping, index) => (
            <div
              key={`${mapping.folderId}-${index}`}
              className="border border-border rounded-lg bg-muted/30 p-4 space-y-3"
              data-testid={`mapping-card-${index}`}
            >
              {/* Row 1: Condition */}
              <div data-testid={`mapping-condition-${index}`}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  {t("ifTextMatches")}
                </label>
                <Input
                  value={mapping.extractionHint}
                  onChange={(e) =>
                    handleUpdateMapping(index, {
                      extractionHint: e.target.value,
                    })
                  }
                  onBlur={onBlur}
                  placeholder={t("ruleConditionPlaceholder")}
                  className=""
                  data-testid={`mapping-hint-input-${index}`}
                />
              </div>

              {/* Row 2: Actions */}
              <div
                className="flex items-end gap-3"
                data-testid={`mapping-actions-${index}`}
              >
                {/* Move to folder */}
                <div className="flex-1 min-w-0" data-testid={`mapping-folder-section-${index}`}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    {t("thenMoveToFolder")}
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full flex items-center gap-2 justify-start"
                    onClick={() => {
                      setEditingIndex(index);
                      setIsFolderPickerOpen(true);
                    }}
                    data-testid={`mapping-folder-btn-${index}`}
                  >
                    <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium truncate text-left">
                      {getFolderName(mapping.folderId)}
                    </span>
                  </Button>
                </div>

                {/* Record as */}
                <div className="flex-1 min-w-0" data-testid={`mapping-record-as-section-${index}`}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    {t("andRecordAs")}
                  </label>
                  <Select
                    value={mapping.transactionType || "NONE"}
                    onValueChange={(value) => {
                      handleUpdateMapping(index, {
                        transactionType:
                          value === "NONE" ? null : (value as TransactionType),
                      });
                      onSave?.();
                    }}
                  >
                    <SelectTrigger
                      className="h-9 w-full text-sm"
                      data-testid={`mapping-type-select-${index}`}
                    >
                      <SelectValue placeholder={t("transactionTypeLabel")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">{t("instNone")}</SelectItem>
                      {TRANSACTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(type.toLowerCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveMapping(index)}
                  data-testid={`remove-mapping-btn-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FolderSelectDialog
        isOpen={isFolderPickerOpen}
        onClose={() => {
          setIsFolderPickerOpen(false);
          setEditingIndex(null);
        }}
        selectedFolderId={
          editingIndex !== null ? mappings[editingIndex].folderId : null
        }
        onSelect={handleFolderSelect}
        title={t("mappingFolder")}
      />
    </div>
  );
}
