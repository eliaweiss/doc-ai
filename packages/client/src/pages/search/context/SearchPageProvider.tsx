"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import { SavedQueryFilters, GraphSettings } from "@zdocs/types";
import { computeDateRangeFromShortcut } from "../../../utilities/computeDateRangeFromShortcut";
import { useSearchStore } from "../../../context-providers/searchStore";
import type {
  SearchableEntityOption,
  EntitySearchState,
  FieldDefinition,
  QuickRangeOption,
} from "@zdocs/types";

const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  xColumn: "date",
  yColumn: "unitPrice",
  chartType: "bar",
  aggregationMode: "sum",
};

// ============================================================================
// SEARCH STORE TYPE (re-exported for convenience)
// ============================================================================
export interface SearchStoreValue {
  availableEntities: SearchableEntityOption[];
  entitiesLoading: boolean;
  entitiesError: string | null;
  entityStates: Record<string, EntitySearchState>;
  entitySchemas: Record<string, FieldDefinition[]>;
  dateFrom: Date | null;
  dateTo: Date | null;
  query: string;
  selectedEntityKeys: string[];
  exactMatch: boolean;
  setQuery: (query: string) => void;
  loadEntities: (orgId: string) => Promise<void>;
  search: (orgId: string) => Promise<void>;
  fetchMore: (orgId: string, schemaType: string) => Promise<void>;
  setSelectedEntityKeys: (keys: string[]) => void;
  setDateRange: (from: Date | null, to: Date | null) => void;
  setExactMatch: (exactMatch: boolean) => void;
  toggleEntitySelection: (key: string) => void;
  clearResults: () => void;
}

// ============================================================================
// SEARCH PAGE CONTEXT (page-specific UI state + search store)
// ============================================================================
interface SearchPageContextValue extends SearchStoreValue {
  // UI-only state (not in store)
  graphSettings: GraphSettings;
  setGraphSettings: (settings: GraphSettings) => void;
  isGraphOpen: boolean;
  setIsGraphOpen: (open: boolean) => void;
  selectedDateShortcut: QuickRangeOption;
  setSelectedDateShortcut: (shortcut: QuickRangeOption) => void;
  activeTabKey: string | null;
  setActiveTabKey: (key: string | null) => void;
  selectedQueryId: string | null;
  setSelectedQueryId: (id: string | null) => void;
  loadedQueryTrigger: number;
  triggerSearch: () => void;
  currentFilters: SavedQueryFilters | null;
  handleQuerySelect: (
    queryId: string,
    savedQuery: string,
    filters: SavedQueryFilters | null
  ) => void;

  // Aliases for backward compatibility
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  selectedEntities: SearchableEntityOption[];
  setSelectedEntities: (entities: SearchableEntityOption[]) => void;
}

const SearchPageContext = createContext<SearchPageContextValue | undefined>(
  undefined
);

export function SearchPageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const searchStore = useSearchStore();

  // UI-only state (not in store)
  const [graphSettings, setGraphSettings] = useState<GraphSettings>(
    DEFAULT_GRAPH_SETTINGS
  );
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [selectedDateShortcut, setSelectedDateShortcut] =
    useState<QuickRangeOption>(3);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [loadedQueryTrigger, setLoadedQueryTrigger] = useState(0);

  // Stable function to trigger a search
  const triggerSearch = useCallback(() => {
    setLoadedQueryTrigger((prev) => prev + 1);
  }, []);

  // Read query from URL params on mount and trigger search
  useEffect(() => {
    const urlQuery = searchParams.get("q");
    if (urlQuery) {
      searchStore.setQuery(urlQuery);
      triggerSearch();
    }
    // Note: searchStore.setQuery is a stable function from Zustand and doesn't need to be in deps.
    // Including the entire searchStore object would cause infinite loops as it changes on every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, triggerSearch]);

  const handleQuerySelect = useCallback(
    (
      queryId: string,
      savedQuery: string,
      filters: SavedQueryFilters | null
    ) => {
      setSelectedQueryId(queryId);
      searchStore.setQuery(savedQuery);
      // Restore schemaTypes from saved filters
      if (filters?.schemaTypes && filters.schemaTypes.length > 0) {
        searchStore.setSelectedEntityKeys(filters.schemaTypes);
      } else {
        searchStore.setSelectedEntityKeys(
          searchStore.availableEntities.map((e) => e.schemaType)
        );
      }
      // Restore graph settings if saved
      if (filters?.graphSettings) {
        setGraphSettings(filters.graphSettings);
        setIsGraphOpen(true); // Auto-open graph panel when saved settings exist
      } else {
        setGraphSettings(DEFAULT_GRAPH_SETTINGS);
        setIsGraphOpen(false);
      }
      // Restore date range shortcut if saved (apply relative to current date)
      if (filters?.dateRangeShortcut) {
        setSelectedDateShortcut(filters.dateRangeShortcut);
        const { from, to } = computeDateRangeFromShortcut(
          filters.dateRangeShortcut
        );
        searchStore.setDateRange(from, to);
      } else {
        // Reset to default (3 months)
        setSelectedDateShortcut(3);
        const { from, to } = computeDateRangeFromShortcut(3);
        searchStore.setDateRange(from, to);
      }
      // Restore active tab if saved
      if (filters?.activeTabKey) {
        setActiveTabKey(filters.activeTabKey);
      }
      // Trigger search execution
      triggerSearch();
    },
    [searchStore, triggerSearch]
  );

  // Build current filters for saving
  const currentFilters: SavedQueryFilters | null = useMemo(() => {
    const hasEntityKeyFilter = searchStore.selectedEntityKeys.length > 0;
    const hasGraphSettings =
      graphSettings.xColumn !== "" || graphSettings.yColumn !== "";
    const hasDateShortcut = selectedDateShortcut !== null;
    const hasActiveTab = activeTabKey !== null;

    if (
      !hasEntityKeyFilter &&
      !hasGraphSettings &&
      !hasDateShortcut &&
      !hasActiveTab
    ) {
      return null;
    }

    return {
      ...(hasEntityKeyFilter
        ? { schemaTypes: searchStore.selectedEntityKeys }
        : {}),
      ...(hasGraphSettings ? { graphSettings } : {}),
      ...(hasDateShortcut ? { dateRangeShortcut: selectedDateShortcut } : {}),
      ...(hasActiveTab ? { activeTabKey } : {}),
    };
  }, [
    searchStore.selectedEntityKeys,
    graphSettings,
    selectedDateShortcut,
    activeTabKey,
  ]);

  const value: SearchPageContextValue = useMemo(
    () => ({
      // UI-only state
      graphSettings,
      setGraphSettings,
      isGraphOpen,
      setIsGraphOpen,
      selectedDateShortcut,
      setSelectedDateShortcut,
      activeTabKey,
      setActiveTabKey,
      selectedQueryId,
      setSelectedQueryId,
      loadedQueryTrigger,
      triggerSearch,
      currentFilters,
      handleQuerySelect,

      // Aliases for backward compatibility
      selectedTypes: searchStore.selectedEntityKeys,
      setSelectedTypes: searchStore.setSelectedEntityKeys,
      selectedEntities: searchStore.availableEntities.filter((e) =>
        searchStore.selectedEntityKeys.includes(e.schemaType)
      ),
      setSelectedEntities: (entities: SearchableEntityOption[]) => {
        searchStore.setSelectedEntityKeys(entities.map((e) => e.schemaType));
      },

      // Re-export everything from searchStore
      availableEntities: searchStore.availableEntities,
      entitiesLoading: searchStore.entitiesLoading,
      entitiesError: searchStore.entitiesError,
      entityStates: searchStore.entityStates,
      entitySchemas: searchStore.entitySchemas,
      dateFrom: searchStore.dateFrom,
      dateTo: searchStore.dateTo,
      query: searchStore.query,
      selectedEntityKeys: searchStore.selectedEntityKeys,
      exactMatch: searchStore.exactMatch,
      setQuery: searchStore.setQuery,
      loadEntities: searchStore.loadEntities,
      search: searchStore.search,
      fetchMore: searchStore.fetchMore,
      setSelectedEntityKeys: searchStore.setSelectedEntityKeys,
      setDateRange: searchStore.setDateRange,
      setExactMatch: searchStore.setExactMatch,
      toggleEntitySelection: searchStore.toggleEntitySelection,
      clearResults: searchStore.clearResults,
    }),
    [
      graphSettings,
      isGraphOpen,
      selectedDateShortcut,
      activeTabKey,
      selectedQueryId,
      loadedQueryTrigger,
      triggerSearch,
      currentFilters,
      handleQuerySelect,
      searchStore,
    ]
  );

  return (
    <SearchPageContext.Provider value={value}>
      {children}
    </SearchPageContext.Provider>
  );
}

export function useSearchPageContext() {
  const context = useContext(SearchPageContext);
  if (context === undefined) {
    throw new Error(
      "useSearchPageContext must be used within SearchPageProvider"
    );
  }
  return context;
}
