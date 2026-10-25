"use client";

import { useTranslations } from "next-intl";
import { Loader2, ChevronDown, AlertCircle } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { SchemaGrid } from "./SchemaGrid";
import type {
  SearchableEntityOption,
  EntitySearchState,
  FieldDefinition,
  EntityResponse,
} from "@zdocs/types";

interface SearchResultTabsProps {
  /** Selected entity schemaTypes in display order */
  selectedEntityKeys: string[];
  /** Map of schemaType to entity option (for display names) */
  entityOptions: Map<string, SearchableEntityOption>;
  /** Per-entity search states */
  entityStates: Record<string, EntitySearchState>;
  /** Per-entity schemas */
  entitySchemas: Record<string, FieldDefinition[]>;
  /** Currently active tab schemaType */
  activeTabKey: string | null;
  /** Called when active tab changes */
  onTabChange: (key: string) => void;
  /** Called when "Fetch More" is clicked */
  onFetchMore: (schemaType: string) => void;
  /** Called when a result row is clicked */
  onResultClick?: (result: EntityResponse) => void;
}

export function SearchResultTabs({
  selectedEntityKeys,
  entityOptions,
  entityStates,
  entitySchemas,
  activeTabKey,
  onTabChange,
  onFetchMore,
  onResultClick,
}: SearchResultTabsProps) {
  const t = useTranslations("search");

  // Filter to only show tabs with results
  const tabsWithResults = selectedEntityKeys.filter((key) => {
    const state = entityStates[key];
    return state && (state.results.length > 0 || state.loading);
  });

  // If no active tab or active tab not in list, select the first tab
  const currentTab =
    activeTabKey && tabsWithResults.includes(activeTabKey)
      ? activeTabKey
      : tabsWithResults[0] || null;

  if (tabsWithResults.length === 0) {
    // Check if any are still loading
    const anyLoading = selectedEntityKeys.some(
      (key) => entityStates[key]?.loading
    );

    if (anyLoading) {
      return (
        <div
          className="flex items-center justify-center h-64"
          data-testid="search-tabs-loading"
        >
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">{t("searching")}</span>
        </div>
      );
    }

    return (
      <div
        className="flex items-center justify-center h-64 text-muted-foreground"
        data-testid="search-tabs-empty"
      >
        {t("noResults")}
      </div>
    );
  }

  const currentState = currentTab ? entityStates[currentTab] : null;
  const currentSchema = currentTab ? entitySchemas[currentTab] : null;
  const currentResults = currentState?.results ?? [];

  return (
    <div className="flex flex-col h-full" data-testid="search-result-tabs">
      {/* Tab headers */}
      <div
        className="flex border-b border-border overflow-x-auto"
        data-testid="search-tabs-header"
      >
        {tabsWithResults.map((key) => {
          const state = entityStates[key];
          const option = entityOptions.get(key);
          const isActive = key === currentTab;
          const count = state?.total ?? 0;
          const isLoading = state?.loading && state.results.length === 0;
          const displayName = option?.displayName || key;

          return (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              data-testid={`search-tab-${key}`}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {count}
                </span>
              )}
              <span>{displayName}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden" data-testid="search-tabs-content">
        {!currentSchema ? (
          // Schema not loaded yet - show loading state
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {currentState?.error && (
              <div
                className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 border-b border-destructive/20"
                data-testid="search-tab-error"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{currentState.error}</span>
              </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-hidden">
              {currentState?.loading && currentState.results.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <SchemaGrid
                  schema={currentSchema}
                  rowData={currentResults}
                  onRowClick={onResultClick}
                />
              )}
            </div>

            {currentState?.hasMore && (
              <div
                className="flex justify-center p-3 border-t border-border"
                data-testid="search-tab-fetch-more"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFetchMore(currentTab!)}
                  disabled={currentState.loading}
                >
                  {currentState.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("loading")}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      {t("fetchMore")} (
                      {currentState.total - currentState.results.length}{" "}
                      {t("remaining")})
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
