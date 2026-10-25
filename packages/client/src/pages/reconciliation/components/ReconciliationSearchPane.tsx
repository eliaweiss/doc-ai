"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, ChevronDown, SearchCheck, TextSearch } from "lucide-react";
import { Input } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@zdocs/client-component";
import { EntitySelector } from "../../search/components/EntitySelector";
import { SchemaGrid } from "../../search/components/SchemaGrid";
import { ReconciliationContextMenu } from "./ReconciliationContextMenu";
import { LoadingDots } from "@zdocs/client-component";
import useOrgStore from "../../../context-providers/orgStore";
import { fetchSearchableEntities } from "../../../utilities/api/fetchSearchableEntities";
import { searchByEntityApi } from "../../../utilities/api/searchByEntity";
import { checkReconciliationStatus } from "../../../utilities/api/checkReconciliationStatus";
import {
  useAlignWithLinked,
  useContextMenuState,
  useReconciledIds,
  useSuggestedDuplicates,
  useToggleDuplicate,
} from "../hooks";
import { SuggestDuplicatesDialog } from "./SuggestDuplicatesDialog";
import { mergeSchemas } from "../utils/mergeSchemas";
import type {
  EntityResponse,
  SearchableEntityOption,
  FieldDefinition,
  ToleranceReconcilePair,
} from "@zdocs/types";
import type { GridApi } from "ag-grid-community";
import { useTranslations } from "next-intl";
import { useReconciliation } from "../context/ReconciliationContext";
import { cn, getDayDrift } from "@zdocs/util";

interface ReconciliationSearchPaneProps {
  side: "source" | "target";
  selection: EntityResponse[];
  onSelectionChange: (selection: EntityResponse[]) => void;
  onSelectionDataChange?: (
    data: EntityResponse[],
    schema: FieldDefinition[]
  ) => void;
  onSearchParametersChange?: (
    entities: SearchableEntityOption[],
    query: string
  ) => void;
  forcedEntities?: SearchableEntityOption[];
  forcedEntity?: SearchableEntityOption;
  forcedQuery?: string;
  loadTrigger?: number;
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

export function ReconciliationSearchPane({
  side,
  selection,
  onSelectionChange,
  onSelectionDataChange,
  onSearchParametersChange,
  forcedEntities,
  forcedEntity,
  forcedQuery,
  loadTrigger,
  opposingEntity,
  opposingEntities,
  filteredResults,
  onSearchResultsChange,
  gridApiRef,
}: ReconciliationSearchPaneProps) {
  const {
    addToReconciledPairs,
    hideReconciled,
    sharedDateFrom,
    sharedDateTo,
    sourceColumnState,
    targetColumnState,
    getSourceColumnStateRef,
    getTargetColumnStateRef,
    loadedSessionTrigger,
    triggerLoadDocuments,
    addFieldReconcileMapping,
  } = useReconciliation();
  const { org } = useOrgStore();
  const t = useTranslations();
  const tReconciliation = useTranslations("reconciliation");

  // Independent state for this pane (not using global search store)
  const [availableEntities, setAvailableEntities] = useState<
    SearchableEntityOption[]
  >([]);
  // Multi-entity selection
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<SearchableEntityOption[]>([]);

  const [query, setQuery] = useState("");

  const [mergedSchema, setMergedSchema] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchMoreLoading, setFetchMoreLoading] = useState(false);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const [entityResultState, setEntityResultState] = useState<
    Record<
      string,
      {
        results: EntityResponse[];
        total: number;
        hasMore: boolean;
      }
    >
  >({});

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

  // Suggest duplicates
  const { groups: duplicateGroups, totalDuplicateCount } =
    useSuggestedDuplicates(filteredResults, mergedSchema);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);

  // For align-with-linked, use the first selected entity as pane entity
  const primaryEntity = selectedEntities[0] || null;

  // Use shared align hook
  const { handleAlignWithLinked } = useAlignWithLinked({
    side,
    paneEntity: primaryEntity,
    paneResults: filteredResults,
    gridApiRef,
  });

  // Load available entity types
  useEffect(() => {
    if (org?.id) {
      setEntitiesLoading(true);
      fetchSearchableEntities(org.id)
        .then((entities) => setAvailableEntities(entities))
        .catch((err) => console.error("Failed to load entities:", err))
        .finally(() => setEntitiesLoading(false));
    }
  }, [org?.id]);

  // React to loadTrigger (session restore - loads single or multi entity state)
  const lastLoadTrigger = useRef(0);
  useEffect(() => {
    if (loadTrigger && loadTrigger > lastLoadTrigger.current) {
      lastLoadTrigger.current = loadTrigger;

      const entitiesToRestore =
        forcedEntities && forcedEntities.length > 0
          ? forcedEntities
          : forcedEntity
            ? [forcedEntity]
            : [];

      if (entitiesToRestore.length > 0) {
        setSelectedTypes(entitiesToRestore.map((entity) => entity.schemaType));
        setSelectedEntities(entitiesToRestore);
      }
      if (forcedQuery !== undefined) setQuery(forcedQuery);

      // Execute search immediately
      if (entitiesToRestore.length > 0) {
        loadDocuments(forcedQuery || "", entitiesToRestore);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTrigger]);

  // React to shared date filter changes - trigger search if entities are selected
  useEffect(() => {
    const entitiesToSearch =
      selectedEntities.length > 0
        ? selectedEntities
        : forcedEntities && forcedEntities.length > 0
          ? forcedEntities
          : forcedEntity
            ? [forcedEntity]
            : [];
    if (entitiesToSearch.length > 0) {
      loadDocuments(forcedQuery || query || "", entitiesToSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerLoadDocuments]);

  // Store callback in ref to avoid triggering effect on callback changes
  const onSearchParametersChangeRef = useRef(onSearchParametersChange);
  onSearchParametersChangeRef.current = onSearchParametersChange;

  // Emit search parameters whenever selected entities change
  useEffect(() => {
    if (onSearchParametersChangeRef.current && selectedEntities.length > 0) {
      onSearchParametersChangeRef.current(selectedEntities, query);
    }
  }, [selectedEntities, query]);

  const loadDocuments = async (
    searchQuery: string,
    overrideEntities?: SearchableEntityOption[],
    mode: "replace" | "append" = "replace"
  ) => {
    const entitiesToUse = overrideEntities || selectedEntities;
    if (entitiesToUse.length === 0 || !org?.id) return;
    if (loading || fetchMoreLoading) return;

    if (mode === "append") {
      setFetchMoreLoading(true);
    } else {
      setLoading(true);
    }
    try {
      // Search each entity type in parallel
      const responses = await Promise.all(
        entitiesToUse.map((entity) => {
          if (
            mode === "append" &&
            !entityResultState[entity.schemaType]?.hasMore
          ) {
            return Promise.resolve(null);
          }

          return searchByEntityApi(org.id, {
            entity,
            query: searchQuery,
            offset:
              mode === "append"
                ? entityResultState[entity.schemaType]?.results.length || 0
                : 0,
            excludeReconciled: hideReconciled,
            reconciliationTargetEntity: opposingEntity,
            exactMatch,
            dateFrom: sharedDateFrom
              ? sharedDateFrom.toISOString().split("T")[0]
              : undefined,
            dateTo: sharedDateTo
              ? sharedDateTo.toISOString().split("T")[0]
              : undefined,
          });
        })
      );

      // Build merged schema from ALL selected entity schemas (not just fetched ones)
      const allEntities = mode === "append" ? selectedEntities : entitiesToUse;
      const schemas = allEntities.map((e) => e.schema || []);
      const merged = mergeSchemas(schemas);
      setMergedSchema(merged);

      const nextEntityResultState: typeof entityResultState =
        mode === "append" ? { ...entityResultState } : {};

      // Update state for entities that were fetched
      for (let i = 0; i < entitiesToUse.length; i++) {
        const entity = entitiesToUse[i];
        const response = responses[i];
        const fetchedResults = response?.results || [];
        const existingResults =
          mode === "append"
            ? entityResultState[entity.schemaType]?.results || []
            : [];

        const results = [...existingResults, ...fetchedResults];
        nextEntityResultState[entity.schemaType] = {
          results,
          total:
            response?.total ?? entityResultState[entity.schemaType]?.total ?? results.length,
          hasMore:
            response?.hasMore ?? entityResultState[entity.schemaType]?.hasMore ?? false,
        };
      }

      // Build allResults from ALL selected entities (including ones not fetched in this batch)
      const allResults: EntityResponse[] = [];
      const fetchedSchemaTypes = new Set(entitiesToUse.map((e) => e.schemaType));
      for (const entity of allEntities) {
        const entityResults = fetchedSchemaTypes.has(entity.schemaType)
          ? nextEntityResultState[entity.schemaType]?.results || []
          : entityResultState[entity.schemaType]?.results || [];

        for (const result of entityResults) {
          allResults.push({
            ...result,
            data: {
              ...result.data,
              _entityDisplayName: entity.displayName,
            },
          });
        }
      }

      allResults.sort((a, b) => {
        const dateA = a.preview?.date || "";
        const dateB = b.preview?.date || "";
        return dateB.localeCompare(dateA);
      });

      setEntityResultState(nextEntityResultState);
      onSearchResultsChange?.(allResults, merged);

      // Check reconciliation status for each selected opposing entity type.
      const entitiesToCheck = opposingEntities?.length
        ? opposingEntities
        : opposingEntity
          ? [opposingEntity]
          : [];
      if (!hideReconciled && entitiesToCheck.length > 0) {
        for (let i = 0; i < entitiesToUse.length; i++) {
          const fetchedResults = responses[i]?.results || [];
          if (fetchedResults.length === 0) continue;
          const ids = fetchedResults.map((r) => r.ref.entityId);
          for (const entityToCheck of entitiesToCheck) {
            checkReconciliationStatus(org.id, ids, entityToCheck.schemaType, side)
              .then((reconciledLinks) => {
                addToReconciledPairs(
                  reconciledLinks.map((r) => ({
                    sourceRef: r.sourceRef,
                    targetRef: r.targetRef,
                    amount: r.amount,
                    currency: r.currency,
                    date: r.date,
                  }))
                );
                reconciledLinks.forEach((r) => {
                  if (!r.sourceRef.field.name || !r.targetRef.field.name) return;
                  const sign = r.amount > 0 ? "+" : "-";
                  const mapping: ToleranceReconcilePair = {
                    dayDrift: getDayDrift(r.sourceRef.ref.date, r.targetRef.ref.date),
                    sign: sign,
                    amountDrift:
                      r.sourceRef.field.value && r.targetRef.field.value
                        ? Math.abs(r.sourceRef.field.value - r.targetRef.field.value)
                        : null,
                  };
                  addFieldReconcileMapping(
                    r.sourceRef.field.name,
                    r.targetRef.field.name,
                    mapping
                  );
                });
              })
              .catch((e) => console.error("Failed to check status", e));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
      if (mode === "replace") {
        onSearchResultsChange?.([], []);
        setMergedSchema([]);
        setEntityResultState({});
      }
    } finally {
      if (mode === "append") {
        setFetchMoreLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleFetchMore = () => {
    const entitiesWithMore = selectedEntities.filter(
      (entity) => entityResultState[entity.schemaType]?.hasMore
    );
    if (entitiesWithMore.length === 0) return;
    loadDocuments(query, entitiesWithMore, "append");
  };

  const handleSearch = () => {
    loadDocuments(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleTypeChange = (
    keys: string[],
    entities: SearchableEntityOption[]
  ) => {
    setSelectedEntities(entities);
    setSelectedTypes(keys);
    // Clear query only when all entities are removed
    if (keys.length === 0) {
      setQuery("");
      onSearchResultsChange?.([], []);
      setMergedSchema([]);
      setEntityResultState({});
    } else {
      loadDocuments(query, entities);
    }
  };

  const handleToggleSelection = useCallback(
    (selectedNodes: EntityResponse[]) => {
      if (selectedNodes.length === 0) {
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
        onSelectionDataChange(selectedData, mergedSchema);
      }
    },
    [
      selection,
      onSelectionChange,
      onSelectionDataChange,
      filteredResults,
      mergedSchema,
      selectedEntities,
      selectedTypes,
    ]
  );

  const selectedIds = new Set(selection.map((s) => s.ref.entityId));
  const hasMore = selectedEntities.some(
    (entity) => entityResultState[entity.schemaType]?.hasMore
  );
  const fetchMoreRemainingCount = selectedEntities.reduce((sum, entity) => {
    const state = entityResultState[entity.schemaType];
    if (!state) return sum;
    return sum + Math.max(0, state.total - state.results.length);
  }, 0);

  // Check if context menu item is reconciled
  const isContextMenuItemReconciled = contextMenu.entityId
    ? reconciledIds.has(contextMenu.entityId)
    : false;

  return (
    <div
      className="flex-1 flex flex-col h-full"
      data-testid="reconciliation-search-pane"
      data-side={side}
    >
      {/* Header */}
      <div
        className={cn(
          "justify-between p-2 bg-muted/50",
          selectedTypes.length > 0 ? "flex justify-between items-center" : ""
        )}
      >
        <div className="flex gap-2 justify-between items-center">
          <h2 className="font-semibold text-center h-full">
            {side === "source" ? "From" : "To"}
          </h2>
          {/* Type Selector - Multi Select Mode */}
          {entitiesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("loading")}...
            </div>
          ) : (
            <EntitySelector
              entities={availableEntities}
              selectedKeys={selectedTypes}
              onSelectionChange={handleTypeChange}
              disabled={loading}
              compactUnselected
              hideAllOption
            />
          )}
        </div>
        {/* Search Filter Input */}
        {selectedTypes.length > 0 && (
          <div data-testid="reconciliation-search-filter">
            <div className="flex gap-2 justify-center items-center">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tReconciliation("filterResults")}
                className="w-64"
                disabled={loading}
                data-testid="reconciliation-search-filter-input"
              />
              <div className="flex" data-testid="reconciliation-search-filter-btn">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearch}
                  disabled={selectedTypes.length === 0}
                  className="rounded-r-none border-r-0"
                  data-testid="reconciliation-search-execute-btn"
                >
                  {exactMatch ? <SearchCheck className="w-4 h-4" /> : <TextSearch className="w-4 h-4" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-l-none px-1"
                      disabled={selectedTypes.length === 0}
                      data-testid="reconciliation-search-mode-dropdown"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" data-testid="reconciliation-search-mode-menu">
                    <DropdownMenuItem
                      onClick={() => { setExactMatch(false); }}
                      data-testid="search-mode-fuzzy"
                    >
                      <TextSearch className="w-4 h-4" />
                      <span className={!exactMatch ? "font-semibold" : ""}>
                        {tReconciliation("fuzzySearch")}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { setExactMatch(true); }}
                      data-testid="search-mode-exact"
                    >
                      <SearchCheck className="w-4 h-4" />
                      <span className={exactMatch ? "font-semibold" : ""}>
                        {tReconciliation("exactSearch")}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div
            className="flex items-center justify-center h-full"
            data-testid="search-pane-loading"
          >
            <LoadingDots message={tReconciliation("searching")} />
          </div>
        ) : selectedTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Search className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">{tReconciliation("selectTypeToBegin")}</p>
          </div>
        ) : filteredResults.length > 0 ? (
          <SchemaGrid
            rowData={filteredResults}
            schema={mergedSchema}
            selectionMode="single"
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            mode="reconcile"
            handleContextMenu={handleCellContextMenu}
            reconciledIds={reconciledIds}
            showEntityType={selectedEntities.length > 1}
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
            hasMore={hasMore}
            fetchMoreRemainingCount={fetchMoreRemainingCount}
            onFetchMore={handleFetchMore}
            fetchMoreLoading={fetchMoreLoading}
            suggestedDuplicatesCount={totalDuplicateCount}
            onSuggestDuplicates={() => setShowDuplicatesDialog(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Search className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">{tReconciliation("noDocumentsFound")}</p>
          </div>
        )}
      </div>

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
