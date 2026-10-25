"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { SchemaGrid } from "../../search/components/SchemaGrid";
import { DocumentSelectDialog } from "./DocumentSelectDialog";
import { ReconciliationContextMenu } from "./ReconciliationContextMenu";
import { LoadingDots } from "@zdocs/client-component";
import useOrgStore from "../../../context-providers/orgStore";
import { fetchDocument } from "../../../utilities/api/fetchDocument";
import { checkReconciliationStatus } from "../../../utilities/api/checkReconciliationStatus";
import {
  useAlignWithLinked,
  useContextMenuState,
  useReconciledIds,
  useSuggestedDuplicates,
  useToggleDuplicate,
} from "../hooks";
import { SuggestDuplicatesDialog } from "./SuggestDuplicatesDialog";
import type {
  EntityResponse,
  SearchableEntityOption,
  FieldDefinition,
  Document,
  LineItemCollectionSchema,
} from "@zdocs/types";
import type { GridApi } from "ag-grid-community";
import { useTranslations } from "next-intl";
import { useReconciliation } from "../context/ReconciliationContext";
import { cn } from "@zdocs/util";

interface ReconciliationBrowsePaneProps {
  side: "source" | "target";
  selection: EntityResponse[];
  onSelectionChange: (selection: EntityResponse[]) => void;
  onSelectionDataChange: (
    data: EntityResponse[],
    schema: FieldDefinition[],
    entity: SearchableEntityOption | null
  ) => void;
  opposingEntity?: SearchableEntityOption;
  opposingEntities?: SearchableEntityOption[];
  onSearchResultsChange?: (
    results: EntityResponse[],
    schema: FieldDefinition[]
  ) => void;
  /** Ref to expose grid API for external control (e.g., scroll synchronization) */
  gridApiRef?: React.MutableRefObject<GridApi | null>;
  filteredResults: EntityResponse[];
}

interface CollectionOption {
  key: string;
  displayName: string;
  schema: LineItemCollectionSchema;
}

/**
 * Convert line items to EntityResponse format for SchemaGrid display
 */
function lineItemsToEntitiesResponse(
  lineItems: Record<string, unknown>[],
  document: Document,
  collectionKey: string
): EntityResponse[] {
  return lineItems.map((item, index) => {
    const entityId = `${document.id}_${collectionKey}_${index}`;

    return {
      data: item,
      ref: {
        entityId,
        documentId: document.id,
        entityType: "LINE_ITEM",
        schemaType: `${document.docType}_${collectionKey}`,
        collectionKey,
        docType: document.docType!,
        isDataset: document.isDataset,
        date: item.date as string,
      },
      preview: {
        date: item.date as string,
        amount: item.amount as number,
        currency: (item.currency as string) || document.currency!,
        description: item.description as string,
      },
    };
  });
}

export function ReconciliationBrowsePane({
  side,
  selection,
  onSelectionChange,
  onSelectionDataChange,
  opposingEntity,
  opposingEntities,
  onSearchResultsChange,
  gridApiRef,
  filteredResults,
}: ReconciliationBrowsePaneProps) {
  const {
    addToReconciledPairs,
    hideReconciled,
    sourceColumnState,
    targetColumnState,
    getSourceColumnStateRef,
    getTargetColumnStateRef,
    loadedSessionTrigger,
  } = useReconciliation();
  const { org } = useOrgStore();
  const tReconciliation = useTranslations("reconciliation");

  // Dialog state
  const [isBrowseDialogOpen, setIsBrowseDialogOpen] = useState(false);

  // Selected document state
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [documentData, setDocumentData] = useState<{
    headerData: Record<string, unknown> | null;
    lineItems: Record<string, Record<string, unknown>[]> | null;
  } | null>(null);
  const [documentType, setDocumentType] = useState<{
    name: string;
    displayName: string | null;
    headerSchema: FieldDefinition[];
    lineItemSchemas: Record<string, LineItemCollectionSchema> | null;
  } | null>(null);

  // Collection selection
  const [collectionOptions, setCollectionOptions] = useState<
    CollectionOption[]
  >([]);
  const [selectedCollectionKey, setSelectedCollectionKey] = useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(false);

  // Use shared hooks
  const { reconciledIds } = useReconciledIds({ side });

  const {
    contextMenu,
    closeContextMenu,
    handleCellContextMenu,
    updateContextMenuDuplicate,
  } = useContextMenuState();
  const { toggleDuplicate } = useToggleDuplicate({
    updateContextMenuDuplicate,
  });
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);

  // Build entity option from selected document and collection
  const currentEntity = useMemo((): SearchableEntityOption | null => {
    if (!selectedDocument || !documentType || !selectedCollectionKey) {
      return null;
    }

    const collectionSchema =
      documentType.lineItemSchemas?.[selectedCollectionKey];
    if (!collectionSchema) return null;

    return {
      isDataset: selectedDocument.isDataset,
      schemaType: `${documentType.name}_${selectedCollectionKey}`,
      docType: documentType.name,
      entityType: "LINE_ITEM",
      collectionKey: selectedCollectionKey,
      displayName: collectionSchema.displayName || selectedCollectionKey,
      schema: collectionSchema.fields,
    };
  }, [selectedDocument, documentType, selectedCollectionKey]);

  // Suggest duplicates using the current schema
  const browseSchema = useMemo(
    () => currentEntity?.schema || [],
    [currentEntity?.schema]
  );
  const { groups: duplicateGroups, totalDuplicateCount } =
    useSuggestedDuplicates(filteredResults, browseSchema);

  // Use shared align hook
  const { handleAlignWithLinked } = useAlignWithLinked({
    side,
    paneEntity: currentEntity,
    paneResults: filteredResults,
    gridApiRef,
  });

  // Handle document selection from dialog
  const handleDocumentSelect = useCallback(async (document: Document) => {
    setLoading(true);
    setSelectedDocument(document);
    setSelectedCollectionKey(null);
    onSelectionDataChange([], [], null);

    try {
      const response = await fetchDocument(document.id);
      // Cast to expected type - API may return broader type
      const docData = response.documentData as {
        headerData: Record<string, unknown> | null;
        lineItems: Record<string, Record<string, unknown>[]> | null;
      } | null;
      setDocumentData(docData);
      setDocumentType(response.documentType);

      // Build collection options
      const collections: CollectionOption[] = [];
      if (response.documentType?.lineItemSchemas && docData?.lineItems) {
        for (const [key, collectionSchema] of Object.entries(
          response.documentType.lineItemSchemas
        )) {
          const items = docData.lineItems[key];
          if (items && items.length > 0) {
            collections.push({
              key,
              displayName: collectionSchema.displayName || key,
              schema: collectionSchema,
            });
          }
        }
      }

      setCollectionOptions(collections);

      // Auto-select if only one collection
      if (collections.length === 1) {
        setSelectedCollectionKey(collections[0].key);
      }
    } catch (error) {
      console.error("Failed to fetch document:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Store callback in ref to avoid triggering effect on callback changes
  const onSearchResultsChangeRef = useRef(onSearchResultsChange);
  onSearchResultsChangeRef.current = onSearchResultsChange;

  // Load line items when collection is selected
  useEffect(() => {
    if (
      !selectedCollectionKey ||
      !documentData?.lineItems ||
      !documentType ||
      !selectedDocument
    ) {
      return;
    }

    const items = documentData.lineItems[selectedCollectionKey] || [];
    const collectionSchema =
      documentType.lineItemSchemas?.[selectedCollectionKey];

    if (!collectionSchema) return;

    const zdocsItems = lineItemsToEntitiesResponse(
      items,
      selectedDocument,
      selectedCollectionKey
    );

    onSelectionDataChange(zdocsItems, collectionSchema.fields, currentEntity);
    onSearchResultsChangeRef.current?.(zdocsItems, collectionSchema.fields);
  }, [
    selectedCollectionKey,
    documentData,
    documentType,
    selectedDocument,
    currentEntity,
  ]);

  // Store callback in ref to avoid triggering effect on callback changes
  const addToReconciledPairsRef = useRef(addToReconciledPairs);
  addToReconciledPairsRef.current = addToReconciledPairs;

  // Check reconciliation status
  useEffect(() => {
    const checkStatus = async () => {
      console.log(
        "checkStatus",
        org?.id,
        opposingEntities,
        filteredResults,
        hideReconciled
      );
      const entitiesToCheck = opposingEntities?.length
        ? opposingEntities
        : opposingEntity
          ? [opposingEntity]
          : [];
      if (
        !org?.id ||
        entitiesToCheck.length === 0 ||
        filteredResults.length === 0 ||
        hideReconciled
      ) {
        return;
      }

      try {
        const ids = filteredResults.map((r) => r.ref.entityId);
        const reconciled = (
          await Promise.all(
            entitiesToCheck.map((entityToCheck) =>
              checkReconciliationStatus(
                org.id,
                ids,
                entityToCheck.schemaType,
                side
              )
            )
          )
        ).flat();
        addToReconciledPairsRef.current(
          reconciled.map((r) => ({
            sourceRef: r.sourceRef,
            targetRef: r.targetRef,
            amount: r.amount,
            currency: r.currency,
            date: r.date,
          }))
        );
      } catch (e) {
        console.error("Failed to check status", e);
      }
    };

    checkStatus();
  }, [org?.id, opposingEntity, opposingEntities, filteredResults, hideReconciled, side]);

  // Handle row selection
  const handleToggleSelection = useCallback(
    (selectedNodes: EntityResponse[]) => {
      // console.log("handleToggleSelection", selectedNodes, currentEntity);
      if (selectedNodes.length === 0 || !currentEntity) {
        onSelectionChange([]);
        return;
      }

      const result = selectedNodes[0];

      const isSelected =
        selection.length === 1 && selection[0].ref.entityId === result.ref.entityId;
      const newSelection = isSelected ? [] : [result];
      onSelectionChange(newSelection);

      if (onSelectionDataChange) {
        const selectedIds = new Set(newSelection.map((s) => s.ref.entityId));
        const selectedData = filteredResults.filter((r) =>
          selectedIds.has(r.ref.entityId)
        );
        onSelectionDataChange(
          selectedData,
          currentEntity?.schema || [],
          currentEntity
        );
      }
    },
    [
      selection,
      onSelectionChange,
      onSelectionDataChange,
      filteredResults,
      currentEntity,
    ]
  );

  useEffect(() => {
    setIsBrowseDialogOpen(true);
  }, []);

  const selectedIds = new Set(selection.map((s) => s.ref.entityId));

  // Check if context menu item is reconciled
  const isContextMenuItemReconciled = contextMenu.entityId
    ? reconciledIds.has(contextMenu.entityId)
    : false;

  return (
    <div
      className="flex-1 flex flex-col h-full"
      data-testid="reconciliation-browse-pane"
      data-side={side}
    >
      {/* Header */}
      <div
        className={cn(
          "justify-between p-2 bg-muted/50",
          selectedDocument ? "flex justify-between items-center" : ""
        )}
      >
        <div className="flex gap-2 justify-between items-center">
          <h2 className="font-semibold text-center h-full">
            {side === "source" ? "From" : "To"}
          </h2>

          {/* Browse Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBrowseDialogOpen(true)}
            className="gap-2"
            data-testid="browse-document-btn"
          >
            <FolderOpen className="w-4 h-4" />
            {selectedDocument
              ? selectedDocument.fileName ||
                selectedDocument.description ||
                tReconciliation("documentSelected")
              : tReconciliation("browseDocuments")}
          </Button>
        </div>

        {/* Collection Selector */}
        {collectionOptions.length > 1 && (
          <div
            className="flex items-center gap-2"
            data-testid="collection-selector"
          >
            <Select
              value={selectedCollectionKey || ""}
              onValueChange={(value) => setSelectedCollectionKey(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue
                  placeholder={tReconciliation("selectCollection")}
                />
              </SelectTrigger>
              <SelectContent>
                {collectionOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div
            className="flex items-center justify-center h-full"
            data-testid="browse-pane-loading"
          >
            <LoadingDots message={tReconciliation("loadingDocument")} />
          </div>
        ) : !selectedDocument ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">
              {tReconciliation("selectDocumentToBrowse")}
            </p>
          </div>
        ) : !selectedCollectionKey && collectionOptions.length > 1 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">{tReconciliation("selectCollection")}</p>
          </div>
        ) : filteredResults && filteredResults.length > 0 ? (
          <SchemaGrid
            rowData={filteredResults}
            schema={currentEntity?.schema || []}
            selectionMode="single"
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            mode="reconcile"
            handleContextMenu={handleCellContextMenu}
            reconciledIds={reconciledIds}
            initialColumnState={
              side === "source" ? sourceColumnState : targetColumnState
            }
            applyColumnStateTrigger={loadedSessionTrigger}
            columnStateRef={
              side === "source"
                ? getSourceColumnStateRef
                : getTargetColumnStateRef
            }
            gridApiRef={gridApiRef}
            flex1flag={false}
            suggestedDuplicatesCount={totalDuplicateCount}
            onSuggestDuplicates={() => setShowDuplicatesDialog(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">{tReconciliation("noLineItems")}</p>
          </div>
        )}
      </div>

      {/* Document Select Dialog */}
      <DocumentSelectDialog
        isOpen={isBrowseDialogOpen}
        onClose={() => setIsBrowseDialogOpen(false)}
        onSelect={handleDocumentSelect}
        title={tReconciliation("selectDocument")}
      />

      {/* Context Menu */}
      {contextMenu.show && contextMenu.documentId && contextMenu.entityId && (
        <ReconciliationContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          documentId={contextMenu.documentId}
          isReconciled={isContextMenuItemReconciled}
          isDuplicate={contextMenu.isDuplicate}
          isLineItem={contextMenu.isLineItem}
          onClose={closeContextMenu}
          onAlignWithLinked={() =>
            handleAlignWithLinked(contextMenu.entityId ?? undefined)
          }
          onToggleDuplicate={() => {
            if (contextMenu.documentId && contextMenu.entityId) {
              toggleDuplicate(
                contextMenu.documentId,
                contextMenu.entityId,
                contextMenu.isDuplicate
              );
            }
          }}
        />
      )}

      {/* Suggest Duplicates Dialog */}
      <SuggestDuplicatesDialog
        isOpen={showDuplicatesDialog}
        onClose={() => setShowDuplicatesDialog(false)}
        groups={duplicateGroups}
      />
    </div>
  );
}
