"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Menu, Plus, Minus, Search, FolderOpen, Maximize2, Minimize2 } from "lucide-react";
import { ReconciliationSearchPane } from "./components/ReconciliationSearchPane";
import { ReconciliationBrowsePane } from "./components/ReconciliationBrowsePane";
import { SavedReconciliationSessionsSidebar } from "./components/SavedReconciliationSessionsSidebar";
import { ReconciliationFilters } from "./components/ReconciliationFilters";
import { SuggestedPairsDialog } from "./components/SuggestedPairsDialog";
import { AmountCurrencyEditor } from "./components/AmountCurrencyEditor";
import {
  ReconciliationProvider,
  useReconciliation,
} from "./context/ReconciliationContext";
import { cn } from "@zdocs/util";
import { Button } from "@zdocs/client-component";
import { useState } from "react";

function ReconciliationWorkbenchContent() {
  const {
    showSidebar,
    setShowSidebar,
    sourcePaneMode,
    setSourcePaneMode,
    targetPaneMode,
    setTargetPaneMode,
    sourceEntity,
    sourceEntities,
    setSourceEntity,
    setSourceEntities,
    setSourceEntityName,
    sourceQuery,
    setSourceQuery,

    leftSelection,
    setLeftSelection,
    targetEntity,
    targetEntities,
    setTargetEntity,
    setTargetEntities,
    setTargetEntityName,
    targetQuery,
    setTargetQuery,
    rightSelection,
    setRightSelection,
    setLeftData,
    setLeftSchema,
    setRightData,
    setRightSchema,
    amount,
    setAmount,
    currency,
    setCurrency,
    loading,
    loadedSessionTrigger,
    handleCreateLink,
    createLinksFromPairs,
    handleDeleteLink,
    setSourceResults,
    setSourceSchema,
    setTargetResults,
    setTargetSchema,
    canLink,
    isCurrentSelectionLinked,
    sourceGridApiRef,
    targetGridApiRef,
    scrollToAlignSelection,
    hasOppositeSign,
    signChoiceMade,
    setAmountToPositive,
    setAmountToNegative,
    sourceResults,
    targetResults,
    suggestedPairs,
    logDataToConsole,
  } = useReconciliation();

  const t = useTranslations("reconciliation");
  const [isSuggestedPairsOpen, setIsSuggestedPairsOpen] = useState(false);
  const [expandedPane, setExpandedPane] = useState<"source" | "target" | null>(null);

  // Extract unique currencies from both source and target results
  const availableCurrencies = useMemo(() => {
    const currencySet = new Set<string>();

    [...sourceResults, ...targetResults].forEach((item) => {
      currencySet.add(item.preview.currency);
      // Check data fields for currency values
      Object.entries(item.data).forEach(([key, value]) => {
        if (
          key.toLowerCase().includes("currency") &&
          typeof value === "string" &&
          value.length === 3
        ) {
          currencySet.add(value);
        }
      });
    });

    // Convert to sorted array, ensure current currency is included
    const currencies = Array.from(currencySet).sort();

    // If no currencies found, return default
    if (currencies.length === 0) {
      return ["USD"];
    }

    return currencies;
  }, [sourceResults, targetResults]);

  return (
    <div className="h-full bg-background overflow-hidden flex flex-col">
      <header className="border-b p-4 bg-background">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{t("workbench.title")}</h1>
          <ReconciliationFilters />
        </div>
        {/* <p className="text-sm text-muted-foreground">
          {t("workbench.description")}
        </p> */}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Saved Sessions */}
        <div
          className={`border-r border-border flex flex-col transition-all duration-200 ${
            showSidebar ? "w-[280px]" : "w-[50px]"
          }`}
          data-testid="reconciliation-sidebar"
        >
          <div className="flex justify-between items-center p-4 border-b border-border">
            {showSidebar && (
              <h2 className="text-lg font-semibold text-foreground">
                {t("workbench.sessions")}
              </h2>
            )}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1 hover:bg-accent rounded transition-colors"
              data-testid="toggle-sidebar-btn"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          {showSidebar && (
            <div className="flex-1 overflow-y-auto p-4">
              <SavedReconciliationSessionsSidebar />
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane: Source */}
            <div
              className={cn(
                "border-r flex flex-col transition-all duration-200",
                expandedPane === "source" ? "flex-1" : expandedPane === "target" ? "hidden" : "w-1/2"
              )}
              data-testid="source-pane"
            >
              {/* Mode Toggle */}
              <div
                className="flex items-center gap-1 px-2 py-1 border-b bg-background"
                data-testid="source-mode-toggle"
              >
                <button
                  onClick={() => setSourcePaneMode("search")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    sourcePaneMode === "search"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                  title={t("workbench.searchMode")}
                  data-testid="source-mode-search-btn"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSourcePaneMode("browse")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    sourcePaneMode === "browse"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                  title={t("workbench.browseMode")}
                  data-testid="source-mode-browse-btn"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setExpandedPane(expandedPane === "source" ? null : "source")}
                  className="p-1.5 rounded transition-colors bg-muted text-muted-foreground hover:bg-accent"
                  title={expandedPane === "source" ? t("workbench.restorePane") : t("workbench.expandPane")}
                  data-testid="source-expand-btn"
                >
                  {expandedPane === "source" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Render appropriate pane based on mode */}
              {sourcePaneMode === "search" ? (
                <ReconciliationSearchPane
                  side="source"
                  filteredResults={sourceResults}
                  selection={leftSelection}
                  onSelectionChange={setLeftSelection}
                  onSelectionDataChange={(data, schema) => {
                    setLeftData(data);
                    setLeftSchema(schema);
                  }}
                  onSearchParametersChange={(entities, query) => {
                    const primaryEntity = entities[0] || null;
                    setSourceEntities(entities);
                    setSourceEntity(primaryEntity);
                    setSourceEntityName(primaryEntity?.displayName || "");
                    setSourceQuery(query);
                  }}
                  forcedEntities={sourceEntities}
                  forcedEntity={sourceEntity || undefined}
                  forcedQuery={sourceQuery}
                  loadTrigger={loadedSessionTrigger}
                  opposingEntity={targetEntity || undefined}
                  opposingEntities={targetEntities}
                  onSearchResultsChange={(results, schema) => {
                    setSourceResults(results);
                    setSourceSchema(schema);
                  }}
                  gridApiRef={sourceGridApiRef}
                />
              ) : (
                <ReconciliationBrowsePane
                  side="source"
                  filteredResults={sourceResults}
                  selection={leftSelection}
                  onSelectionChange={setLeftSelection}
                  onSelectionDataChange={(data, schema, entity) => {
                    setTargetEntity(entity);
                    setLeftData(data);
                    setLeftSchema(schema);
                  }}
                  opposingEntity={targetEntity || undefined}
                  opposingEntities={targetEntities}
                  onSearchResultsChange={(results, schema) => {
                    setSourceResults(results);
                    setSourceSchema(schema);
                  }}
                  gridApiRef={sourceGridApiRef}
                />
              )}
            </div>

            {/* Right Pane: Target */}
            <div
              className={cn(
                "flex flex-col transition-all duration-200",
                expandedPane === "target" ? "flex-1" : expandedPane === "source" ? "hidden" : "w-1/2"
              )}
              data-testid="target-pane"
            >
              {/* Mode Toggle */}
              <div
                className="flex items-center gap-1 px-2 py-1 border-b bg-background"
                data-testid="target-mode-toggle"
              >
                <button
                  onClick={() => setTargetPaneMode("search")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    targetPaneMode === "search"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                  title={t("workbench.searchMode")}
                  data-testid="target-mode-search-btn"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTargetPaneMode("browse")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    targetPaneMode === "browse"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                  title={t("workbench.browseMode")}
                  data-testid="target-mode-browse-btn"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setExpandedPane(expandedPane === "target" ? null : "target")}
                  className="p-1.5 rounded transition-colors bg-muted text-muted-foreground hover:bg-accent"
                  title={expandedPane === "target" ? t("workbench.restorePane") : t("workbench.expandPane")}
                  data-testid="target-expand-btn"
                >
                  {expandedPane === "target" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Render appropriate pane based on mode */}
              {targetPaneMode === "search" ? (
                <ReconciliationSearchPane
                  side="target"
                  filteredResults={targetResults}
                  selection={rightSelection}
                  onSelectionChange={setRightSelection}
                  onSelectionDataChange={(data, schema) => {
                    setRightData(data);
                    setRightSchema(schema);
                  }}
                  onSearchParametersChange={(entities, query) => {
                    const primaryEntity = entities[0] || null;
                    setTargetEntities(entities);
                    setTargetEntity(primaryEntity);
                    setTargetEntityName(primaryEntity?.displayName || "");
                    setTargetQuery(query);
                  }}
                  forcedEntities={targetEntities}
                  forcedEntity={targetEntity || undefined}
                  forcedQuery={targetQuery}
                  loadTrigger={loadedSessionTrigger}
                  opposingEntity={sourceEntity || undefined}
                  opposingEntities={sourceEntities}
                  onSearchResultsChange={(results, schema) => {
                    setTargetResults(results);
                    setTargetSchema(schema);
                  }}
                  gridApiRef={targetGridApiRef}
                />
              ) : (
                <ReconciliationBrowsePane
                  side="target"
                  filteredResults={targetResults}
                  selection={rightSelection}
                  onSelectionChange={setRightSelection}
                  onSelectionDataChange={(data, schema, entity) => {
                    setTargetEntity(entity);
                    setRightData(data);
                    setRightSchema(schema);
                  }}
                  opposingEntity={sourceEntity || undefined}
                  opposingEntities={sourceEntities}
                  onSearchResultsChange={(results, schema) => {
                    setTargetResults(results);
                    setTargetSchema(schema);
                  }}
                  gridApiRef={targetGridApiRef}
                />
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div
            className="p-2 px-4 bg-background flex items-center gap-4"
            data-testid="reconciliation-action-bar"
          >
            {suggestedPairs.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  onClick={() => setIsSuggestedPairsOpen(true)}
                >
                  {t("workbench.suggestedPairsCount", {
                    count: suggestedPairs.length,
                  })}
                  <Plus className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
            <div className="flex-1">
              {(leftSelection.length > 0 || rightSelection.length > 0) && (
                <p className="text-sm font-medium">
                  {t("workbench.linkSummary", {
                    sourceCount: leftSelection.length,
                    targetCount: rightSelection.length,
                  })}
                </p>
              )}
            </div>

            <AmountCurrencyEditor
              amount={amount}
              currency={currency}
              availableCurrencies={availableCurrencies}
              onAmountChange={setAmount}
              onCurrencyChange={setCurrency}
              hasOppositeSign={hasOppositeSign}
              signChoiceMade={signChoiceMade}
              onSetPositive={setAmountToPositive}
              onSetNegative={setAmountToNegative}
            />

            {isCurrentSelectionLinked ? (
              <button
                onClick={handleDeleteLink}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t("workbench.deleting") : t("workbench.deleteLink")}
              </button>
            ) : (
              <button
                onClick={() => {
                  handleCreateLink();
                  scrollToAlignSelection();
                }}
                disabled={!canLink}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t("workbench.creating") : t("workbench.createLink")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Pairs Dialog */}
      <SuggestedPairsDialog
        isOpen={isSuggestedPairsOpen}
        onClose={() => setIsSuggestedPairsOpen(false)}
        suggestedPairs={suggestedPairs}
        onCreateLinks={createLinksFromPairs}
      />
    </div>
  );
}

export default function ReconciliationWorkbenchPageComponent() {
  return (
    <ReconciliationProvider>
      <ReconciliationWorkbenchContent />
    </ReconciliationProvider>
  );
}
