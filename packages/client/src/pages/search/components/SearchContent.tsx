"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useTranslations } from "next-intl";
import { FileSearch } from "lucide-react";
import { SearchResultTabs } from "./SearchResultTabs";
import { SearchToolbar } from "./SearchToolbar";
import { useSearchPageContext } from "../context/SearchPageProvider";
import type {
  SearchableEntityOption,
  EntityResponse,
  EntitySearchState,
} from "@zdocs/types";
import useOrgStore from "../../../context-providers/orgStore";

export function SearchContent() {
  const {
    query,
    setQuery,
    selectedTypes,
    setSelectedTypes,
    loadedQueryTrigger,
    activeTabKey,
    setActiveTabKey,
    availableEntities,
    entityStates,
    entitySchemas,
    loadEntities,
    search,
    fetchMore,
  } = useSearchPageContext();
  const t = useTranslations("search");
  const { org } = useOrgStore();
  const orgId = org?.id;

  // Check if we have searched (has results in any entity state)
  const hasSearched = useMemo(() => {
    return Object.values(entityStates).some(
      (s: EntitySearchState) => s.results && s.results.length > 0
    );
  }, [entityStates]);

  // Build entity options map for quick lookup
  const entityOptionsMap = useMemo(() => {
    const map = new Map<string, SearchableEntityOption>();
    for (const entity of availableEntities) {
      map.set(entity.schemaType, entity);
    }
    return map;
  }, [availableEntities]);

  // Track if we've done the initial auto-select
  const hasInitializedRef = useRef(false);

  // Load entities when org changes
  useEffect(() => {
    if (org?.id) {
      hasInitializedRef.current = false; // Reset on org change
      loadEntities(org.id);
    }
  }, [org?.id, loadEntities]);

  // Auto-select all entities when first loaded (only once per org)
  useEffect(() => {
    if (
      availableEntities.length > 0 &&
      selectedTypes.length === 0 &&
      !hasInitializedRef.current
    ) {
      hasInitializedRef.current = true;
      setSelectedTypes(
        availableEntities.map((e: SearchableEntityOption) => e.schemaType)
      );
    }
  }, [availableEntities, selectedTypes.length, setSelectedTypes]);

  // Stable search handler with proper dependencies
  const executeSearch = useCallback(async () => {
    // NOTE: empty search are allowed
    if (!orgId) return;
    if (selectedTypes.length === 0) return;

    setQuery(query.trim());
    await search(orgId);
  }, [orgId, selectedTypes.length, query, setQuery, search]);

  // Auto-search when a saved query is loaded
  useEffect(() => {
    // NOTE: empty search are allowed
    if (loadedQueryTrigger && orgId) {
      executeSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedQueryTrigger, orgId]);

  // Trigger search when entity selection changes
  useEffect(() => {
    if (selectedTypes.length > 0 && orgId) {
      executeSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypes, orgId]);

  // Auto-select first tab with results when entity states change
  useEffect(() => {
    if (!activeTabKey || !entityStates[activeTabKey]?.results?.length) {
      const firstWithResults = selectedTypes.find(
        (key) => entityStates[key]?.results?.length > 0
      );
      if (firstWithResults) {
        setActiveTabKey(firstWithResults);
      }
    }
  }, [entityStates, selectedTypes, activeTabKey, setActiveTabKey]);

  const handleFetchMore = useCallback(
    async (schemaType: string) => {
      if (!orgId) return;
      await fetchMore(orgId, schemaType);
    },
    [orgId, fetchMore]
  );

  const handleResultClick = (result: EntityResponse) => {
    // Open document in new tab
    if (result.ref.documentId) {
      window.open(`/document/${result.ref.documentId}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex flex-col h-full p-4" data-testid="search-content">
      {/* Unified Toolbar */}
      <SearchToolbar />

      {/* Search Results Area */}
      <div className="flex-1 overflow-hidden" data-testid="search-results">
        {/* Empty State - Before Search */}
        {!hasSearched && (
          <div
            className="flex flex-col items-center justify-center h-full border border-dashed border-border rounded-lg"
            data-testid="search-empty-state"
          >
            <FileSearch className="w-12 h-12 mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t("resultsPlaceholder")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("resultsPlaceholderHint")}
            </p>
          </div>
        )}

        {/* Results */}
        {hasSearched && (
          <div className="flex flex-col h-full gap-4">
            <div className="flex-1 overflow-hidden">
              <SearchResultTabs
                selectedEntityKeys={selectedTypes}
                entityOptions={entityOptionsMap}
                entityStates={entityStates}
                entitySchemas={entitySchemas}
                activeTabKey={activeTabKey}
                onTabChange={setActiveTabKey}
                onFetchMore={handleFetchMore}
                onResultClick={handleResultClick}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
