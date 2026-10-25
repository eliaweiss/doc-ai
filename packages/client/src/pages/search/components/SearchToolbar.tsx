"use client";

import React, { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Loader2,
  Crosshair,
  MoreVertical,
} from "lucide-react";
import { Input } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@zdocs/client-component";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import { TypeFilterDropdown } from "./TypeFilterDropdown";
import { CompactDateRangePicker } from "./CompactDateRangePicker";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { useSearchPageContext } from "../context/SearchPageProvider";
import useOrgStore from "../../../context-providers/orgStore";
import { useMobileScreen } from "../../../hooks/useMobileScreen";
import type { SearchableEntityOption } from "@zdocs/types";

export function SearchToolbar() {
  const {
    query,
    setQuery,
    selectedTypes,
    setSelectedTypes,
    selectedEntities,
    setSelectedEntities,
    availableEntities,
    entityStates,
    dateFrom,
    dateTo,
    setDateRange,
    selectedDateShortcut,
    setSelectedDateShortcut,
    exactMatch,
    setExactMatch,
    search,
  } = useSearchPageContext();
  const t = useTranslations("search");
  const { org } = useOrgStore();
  const orgId = org?.id;
  const isMobile = useMobileScreen();

  // Check if any search is in progress
  const isSearching = Object.values(entityStates).some(
    (s) => s.loading
  );

  // Check if search is disabled
  const isSearchDisabled = isSearching || selectedTypes.length === 0;

  // Check if all entities are selected
  const isAllSelected = useMemo(() => {
    return (
      selectedTypes.length === availableEntities.length &&
      availableEntities.every((e) => selectedTypes.includes(e.schemaType))
    );
  }, [selectedTypes, availableEntities]);

  // Stable search handler
  const executeSearch = useCallback(async () => {
    if (!orgId) return;
    if (selectedTypes.length === 0) return;

    setQuery(query.trim());
    await search(orgId);
  }, [orgId, selectedTypes.length, query, setQuery, search]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        executeSearch();
      }
    },
    [executeSearch]
  );

  // Handle type change
  const handleTypeChange = (
    keys: string[],
    entities: SearchableEntityOption[]
  ) => {
    setSelectedTypes(keys);
    setSelectedEntities(entities);
  };

  // Handle remove type
  const handleRemoveType = (key: string) => {
    const newKeys = selectedTypes.filter((k) => k !== key);
    const newEntities = availableEntities.filter((e) =>
      newKeys.includes(e.schemaType)
    );
    handleTypeChange(newKeys, newEntities);
  };

  // Handle clear date
  const handleClearDate = () => {
    setSelectedDateShortcut(null);
    setDateRange(null, null);
  };

  return (
    <div className="mb-4" data-testid="search-header">
      <div className="flex flex-col gap-2">
        {/* Mobile: Stack vertically, Desktop: Horizontal row */}
        <div
          className={`flex items-center gap-2 ${isMobile ? "flex-col" : "flex-row"
            }`}
          data-testid="search-toolbar"
        >
          {/* Search input - full width on mobile */}
          <div className={`relative ${isMobile ? "pl-10 w-full" : "flex-1"}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("searchPlaceholder")}
              className={`pl-10 ${isMobile ? "h-11 text-base" : "h-10"}`}
              data-testid="search-input"
            />
          </div>

          {/* Controls - Mobile: Simplified with Advanced menu, Desktop: Single row */}
          {isMobile ? (
            <>
              {/* Mobile: First row - Advanced menu button */}
              <div className="flex items-center gap-2 w-full">


                {/* Mobile: Second row - Search button */}
                <div className="flex items-center gap-2 w-full">
                  <Button
                    onClick={executeSearch}
                    disabled={isSearchDisabled}
                    className="h-11 flex-1 min-w-0"
                    data-testid="search-btn"
                  >
                    {isSearching ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : null}
                    {t("searchButton")}
                  </Button>
                </div>
                {/* Advanced menu button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 flex-1 min-w-0 "
                      data-testid="advanced-menu-btn"
                    >
                      <MoreVertical className=" " />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] p-4"
                    align="start"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Type filter */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">
                          {t("filterByType")}
                        </label>
                        <TypeFilterDropdown
                          entities={availableEntities}
                          selectedKeys={selectedTypes}
                          onSelectionChange={handleTypeChange}
                          disabled={isSearching}
                        />
                      </div>

                      {/* Date range picker */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">
                          {t("dateRange")}
                        </label>
                        <CompactDateRangePicker
                          dateFrom={dateFrom}
                          dateTo={dateTo}
                          onDateRangeChange={setDateRange}
                          selectedQuickRange={selectedDateShortcut}
                          onQuickRangeChange={setSelectedDateShortcut}
                          disabled={isSearching}
                          onQuickRangeSelect={executeSearch}
                        />
                      </div>

                      <div className="border-t pt-4 space-y-3">
                        {/* Exact match toggle */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="exact-match"
                            checked={exactMatch}
                            onCheckedChange={(checked) => {
                              setExactMatch(checked as boolean);
                              setTimeout(() => executeSearch(), 0);
                            }}
                            data-testid="exact-match-menu-item"
                          />
                          <label
                            htmlFor="exact-match"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                          >
                            <Crosshair className="w-4 h-4" />
                            {exactMatch ? t("exactMatchOn") : t("exactMatchOff")}
                          </label>
                        </div>

                      </div>

                    </div>
                  </PopoverContent>
                </Popover>
              </div>

            </>
          ) : (
            /* Desktop: Single horizontal row */
            <div className="flex items-center gap-2 shrink-0">
              {/* Exact match toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={exactMatch ? "secondary" : "ghost"}
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => {
                        setExactMatch(!exactMatch);
                        setTimeout(() => executeSearch(), 0);
                      }}
                      data-testid="exact-match-toggle"
                    >
                      <Crosshair
                        className={`w-4 h-4 ${exactMatch ? "text-primary" : "text-muted-foreground"
                          }`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {exactMatch ? t("exactMatchOn") : t("exactMatchOff")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Type filter */}
              <TypeFilterDropdown
                entities={availableEntities}
                selectedKeys={selectedTypes}
                onSelectionChange={handleTypeChange}
                disabled={isSearching}
              />

              {/* Date range picker */}
              <CompactDateRangePicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateRangeChange={setDateRange}
                selectedQuickRange={selectedDateShortcut}
                onQuickRangeChange={setSelectedDateShortcut}
                disabled={isSearching}
                onQuickRangeSelect={executeSearch}
              />

              {/* Search button */}
              <Button
                onClick={executeSearch}
                disabled={isSearchDisabled}
                className="h-10 px-6"
                data-testid="search-btn"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {t("searchButton")}
              </Button>

            </div>
          )}
        </div>

        {/* Filter chips - Desktop only (mobile shows in advanced menu) */}
        {!isMobile && (
          <ActiveFilterChips
            selectedEntities={selectedEntities}
            onRemoveEntity={handleRemoveType}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onClearDate={handleClearDate}
            isAllSelected={isAllSelected}
          />
        )}
      </div>
    </div>
  );
}
