"use client";

import { FolderOpen } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { FolderSelectDialog } from "../FolderSelectDialog";
import { useDocsStore } from "../../../../context-providers/docsStore";
import { flattenFolderTree } from "../../../drive/functions/folder-tree";

export function SchemaExtractionSettings() {
  const {
    localExtractionHint,
    setLocalExtractionHint,
    localDefaultFolderId,
    setLocalDefaultFolderId,
  } = useSchemaPage();
  const t = useTranslations("schema");
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const folderTree = useDocsStore((state) => state.folderTree);

  // Get root folder (first folder in tree or one with isRoot === true)
  const rootFolder = useMemo(() => {
    if (folderTree.length === 0) return null;
    return folderTree.find((f) => f.isRoot || !f.parentId) || folderTree[0];
  }, [folderTree]);

  // If folder not found, set to root folder id
  useEffect(() => {
    if (!localDefaultFolderId || !rootFolder) return;
    const flattened = flattenFolderTree(folderTree);
    const folderExists = flattened.find((f) => f.id === localDefaultFolderId);
    if (!folderExists) {
      setLocalDefaultFolderId(rootFolder.id);
    }
  }, [localDefaultFolderId, folderTree, rootFolder, setLocalDefaultFolderId]);

  const folderName = useMemo(() => {
    if (!localDefaultFolderId) return null;
    const flattened = flattenFolderTree(folderTree);
    const folder = flattened.find((f) => f.id === localDefaultFolderId);
    if (!folder) {
      return rootFolder?.name || null;
    }
    return folder.name;
  }, [localDefaultFolderId, folderTree, rootFolder]);

  return (
    <div className="space-y-4" data-testid="schema-extraction-settings">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t("extractionSettings")}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          {t("aiInstructionsDescription")}
        </p>
        <Textarea
          value={localExtractionHint}
          onChange={(e) => setLocalExtractionHint(e.target.value)}
          placeholder={t("extractionHintPlaceholder")}
          className="text-sm min-h-[60px] resize-none"
          data-testid="schema-extraction-hint-input"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t("defaultFolder")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex items-center gap-1.5"
          onClick={() => setIsFolderPickerOpen(true)}
          data-testid="schema-default-folder-btn"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          {localDefaultFolderId ? (
            <span>{folderName}</span>
          ) : (
            <span className="italic opacity-50">
              {t("noDefaultFolder")}
            </span>
          )}
        </Button>
      </div>

      <FolderSelectDialog
        isOpen={isFolderPickerOpen}
        onClose={() => setIsFolderPickerOpen(false)}
        selectedFolderId={localDefaultFolderId}
        onSelect={setLocalDefaultFolderId}
      />
    </div>
  );
}
