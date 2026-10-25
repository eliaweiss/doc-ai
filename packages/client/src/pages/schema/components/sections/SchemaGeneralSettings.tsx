"use client";

import { FolderOpen } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { FolderSelectDialog } from "../FolderSelectDialog";
import { FolderMappingEditor } from "../FolderMappingEditor";
import { useDocsStore } from "../../../../context-providers/docsStore";
import { flattenFolderTree } from "../../../drive/functions/folder-tree";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

export function SchemaGeneralSettings() {
  const {
    selectedSchema,
    localDescription,
    setLocalDescription,
    localExtractionHint,
    setLocalExtractionHint,
    localDefaultFolderId,
    setLocalDefaultFolderId,
    localFolderMapping,
    setLocalFolderMapping,
    hasUnsavedChanges,
    handleSave,
    saveNow,
  } = useSchemaPage();
  const t = useTranslations("schema");
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const folderTree = useDocsStore((state) => state.folderTree);
  const { logEvent } = useLogUserJourneyEvent();

  const rootFolder = useMemo(() => {
    if (folderTree.length === 0) return null;
    return folderTree.find((f) => f.isRoot || !f.parentId) || folderTree[0];
  }, [folderTree]);

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

  if (!selectedSchema) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="schema-general-settings">

      {/* Type Description Section */}
      <div data-testid="type-description-section">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t("typeDescription")}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          {t("typeDescriptionHint")}
        </p>
        <Textarea
          value={localDescription || ""}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={() => {
            if (hasUnsavedChanges) {
              handleSave();
            }
          }}
          placeholder={t("typeDescriptionPlaceholder")}
          className="text-sm min-h-[60px] resize-none"
          data-testid="schema-description-input"
        />
      </div>

      {/* AI Instructions Section */}
      <div data-testid="ai-instructions-section">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t("extractionHint")}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          {t("aiInstructionsDescription")}
        </p>
        <Textarea
          value={localExtractionHint || ""}
          onChange={(e) => setLocalExtractionHint(e.target.value)}
          onBlur={() => {
            if (hasUnsavedChanges) {
              handleSave();
            }
          }}
          placeholder={t("extractionHintPlaceholder")}
          className="text-sm min-h-[60px] resize-none"
          data-testid="schema-extraction-hint-input"
        />
      </div>

      {/* Folder Routing Section - unified default + rules */}
      <div data-testid="folder-routing-section">
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t("folderRouting")}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t("folderRoutingDescription")}
        </p>

        {/* Default Destination */}
        <div className="mb-5" data-testid="default-destination-section">
          <h4 className="text-sm font-semibold text-foreground mb-1">
            {t("defaultDestination")}
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            {t("defaultDestinationDescription")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex items-center gap-2"
            onClick={() => setIsFolderPickerOpen(true)}
            data-testid="schema-default-folder-btn"
          >
            <FolderOpen className="w-4 h-4 text-primary" />
            {localDefaultFolderId ? (
              <span className="font-medium">{folderName}</span>
            ) : (
              <span className="italic text-muted-foreground">
                {t("noDefaultFolder")}
              </span>
            )}
          </Button>
        </div>

        {/* Custom Rules */}
        <div data-testid="custom-rules-section">
          <FolderMappingEditor
            mappings={localFolderMapping}
            onChange={setLocalFolderMapping}
            onBlur={() => {
              if (hasUnsavedChanges) {
                handleSave();
              }
            }}
            onSave={saveNow}
          />
        </div>
      </div>

      <FolderSelectDialog
        isOpen={isFolderPickerOpen}
        onClose={() => setIsFolderPickerOpen(false)}
        selectedFolderId={localDefaultFolderId}
        onSelect={(folderId) => {
          setLocalDefaultFolderId(folderId);
          saveNow();
          const flattened = flattenFolderTree(folderTree);
          const folder = flattened.find((f) => f.id === folderId);
          logEvent({
            eventType: "schema_default_folder_selected",
            eventData: {
              folderId,
              folderName: folder?.name,
              schemaId: selectedSchema?.id,
            },
          });
        }}
      />
    </div>
  );
}
