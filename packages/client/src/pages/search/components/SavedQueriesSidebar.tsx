"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Plus, Trash2, Loader2, BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zdocs/client-component";
import { toast } from "sonner";
import {
  listSavedQueriesApi,
  createSavedQueryApi,
  deleteSavedQueryApi,
  updateSavedQueryApi,
} from "../../../utilities/api/savedQueries";
import type { SavedQuery } from "@zdocs/types";
import { useSearchPageContext } from "../context/SearchPageProvider";

export function SavedQueriesSidebar() {
  const {
    query: currentQuery,
    currentFilters,
    selectedQueryId,
    handleQuerySelect: onQuerySelect,
  } = useSearchPageContext();
  const t = useTranslations("search");
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState("");
  const [deleteQuery, setDeleteQuery] = useState<SavedQuery | null>(null);

  // Load saved queries on mount
  useEffect(() => {
    loadSavedQueries();
  }, []);

  const loadSavedQueries = async () => {
    setIsLoading(true);
    try {
      const queries = await listSavedQueriesApi();
      setSavedQueries(queries);
    } catch (error) {
      console.error("Failed to load saved queries:", error);
      toast.error(t("loadQueriesFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClick = () => {
    // NOTE: empty search are allowed
    setQueryName("");
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = async () => {
    if (!queryName.trim()) {
      toast.error(t("queryNameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const newQuery = await createSavedQueryApi({
        name: queryName.trim(),
        query: currentQuery,
        filters: currentFilters,
      });
      setSavedQueries((prev) => [newQuery, ...prev]);
      setShowSaveDialog(false);
      toast.success(t("querySaved"));
    } catch (error) {
      console.error("Failed to save query:", error);
      toast.error(t("saveQueryFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteQuery) return;

    try {
      await deleteSavedQueryApi(deleteQuery.id);
      setSavedQueries((prev) => prev.filter((q) => q.id !== deleteQuery.id));
      toast.success(t("queryDeleted"));
    } catch (error) {
      console.error("Failed to delete query:", error);
      toast.error(t("deleteQueryFailed"));
    } finally {
      setDeleteQuery(null);
    }
  };

  const handleQueryClick = (query: SavedQuery) => {
    onQuerySelect(query.id, query.query, query.filters);
  };

  const handleUpdateQuery = async (queryId: string) => {
    setIsUpdating(queryId);
    try {
      const updatedQuery = await updateSavedQueryApi(queryId, {
        query: currentQuery,
        filters: currentFilters,
      });
      setSavedQueries((prev) =>
        prev.map((q) => (q.id === queryId ? updatedQuery : q))
      );
      toast.success(t("queryUpdated"));
    } catch (error) {
      console.error("Failed to update query:", error);
      toast.error(t("updateQueryFailed"));
    } finally {
      setIsUpdating(null);
    }
  };

  // NOTE: empty search are allowed
  const canSave = currentFilters?.schemaTypes && currentFilters.schemaTypes.length > 0;

  return (
    <div className="flex flex-col h-full" data-testid="saved-queries-sidebar">
      {/* Header with Save button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          {t("savedQueries")}
        </h3>
        <Button
          variant="outline"
          size="sm"
          disabled={!canSave}
          className="text-xs"
          onClick={handleSaveClick}
          data-testid="save-query-btn"
        >
          <Plus className="w-3 h-3 mr-1" />
          {t("saveQuery")}
        </Button>
      </div>

      {/* Saved Queries List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div
            className="flex items-center justify-center py-8"
            data-testid="loading-queries"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : savedQueries.length === 0 ? (
          <div
            className="text-sm text-muted-foreground text-center py-8"
            data-testid="no-saved-queries"
          >
            <Bookmark className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>{t("noSavedQueries")}</p>
            <p className="text-xs mt-1">{t("noSavedQueriesHint")}</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {savedQueries.map((query) => {
              const isSelected = selectedQueryId === query.id;
              return (
                <li key={query.id} className="group relative">
                  <button
                    onClick={() => handleQueryClick(query)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 pr-16 ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent"
                    }`}
                    data-testid={`saved-query-${query.id}`}
                  >
                    <Bookmark
                      className={`w-4 h-4 flex-shrink-0 ${
                        isSelected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <div className="overflow-hidden flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className={`truncate ${
                            isSelected ? "text-primary font-medium" : "text-foreground"
                          }`}
                        >
                          {query.name}
                        </span>
                        {query.filters?.graphSettings && (
                          <BarChart3 className="w-3 h-3 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate block">
                        {query.query}
                      </span>
                    </div>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateQuery(query.id);
                        }}
                        disabled={isUpdating === query.id}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-primary/10 rounded transition-all"
                        title={t("updateQuery")}
                        data-testid={`update-query-${query.id}`}
                      >
                        {isUpdating === query.id ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteQuery(query);
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
                      data-testid={`delete-query-${query.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Save Query Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid="save-query-dialog">
          <DialogHeader>
            <DialogTitle>{t("saveQueryTitle")}</DialogTitle>
            <DialogDescription>{t("saveQueryDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder={t("queryNamePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveConfirm();
                }
              }}
              data-testid="query-name-input"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t("queryToSave")}: <span className="font-medium">{currentQuery}</span>
            </p>
            {currentFilters?.graphSettings && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-primary" />
                {t("graphSettingsIncluded")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              data-testid="cancel-save-btn"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveConfirm}
              disabled={isSaving || !queryName.trim()}
              data-testid="confirm-save-btn"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteQuery}
        onOpenChange={(open) => !open && setDeleteQuery(null)}
      >
        <AlertDialogContent data-testid="delete-query-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteQueryTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteQueryConfirmation", { name: deleteQuery?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-btn"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
