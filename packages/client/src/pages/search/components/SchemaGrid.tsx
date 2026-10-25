"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowClickedEvent,
  RowSelectedEvent,
  SelectionChangedEvent,
  ColumnState,
  RowDoubleClickedEvent,
  Theme,
} from "ag-grid-community";
import { themeQuartz } from "ag-grid-community";
import type {
  FieldDefinition,
  EntityResponse,
  GridColumnState,
} from "@zdocs/types";
import {
  formatDate,
  getCurrencySymbol,
  exportGridToCSV,
  exportGridToMarkdown,
} from "@zdocs/util";
import FormatCurrency from "../../document/components/FormatCurrency";
import { ChevronDown, Copy, Download, Expand, Loader2, Minimize2 } from "lucide-react";
import { Button } from "@zdocs/client-component";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@zdocs/client-component";
import { toast } from "sonner";
import { useTheme } from "../../../hooks/useTheme";

export type SchemaGridMode = "search" | "browse" | "reconcile";

/**
 * Checks if a string is a valid URL
 */
function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

interface SchemaGridProps {
  dir?: "ltr" | "rtl";
  schema: FieldDefinition[];
  rowData: EntityResponse[];
  onRowClick?: (result: EntityResponse) => void;
  /** When true, shows Entity Type column as first column (for "All" tab) */
  showEntityType?: boolean;
  /** When true, enables checkbox selection mode */
  selectionMode?: "multiple" | "single" | undefined;
  /** Set of selected row IDs */
  selectedIds?: Set<string>;
  /** Callback when selection is toggled */
  onToggleSelection?: (selectedNodes: EntityResponse[]) => void;
  /** Display mode: search (default), browse, or reconcile */
  mode?: SchemaGridMode;
  /** Set of IDs that are reconciled (for highlighting) */
  reconciledIds?: Set<string>;
  handleContextMenu?: (params: any) => void;
  /** Initial column state to restore (order, width, visibility) */
  initialColumnState?: GridColumnState[] | null;
  /** Trigger to apply initial column state (e.g., when session is loaded) */
  applyColumnStateTrigger?: number;
  /** Ref to get current column state (for saving sessions) */
  columnStateRef?: React.MutableRefObject<(() => GridColumnState[]) | null>;
  /** Ref to expose grid API for external control (e.g., scroll synchronization) */
  gridApiRef?: React.MutableRefObject<GridApi | null>;
  flex1flag?: boolean;
  hasMore?: boolean;
  fetchMoreRemainingCount?: number;
  onFetchMore?: () => void;
  fetchMoreLoading?: boolean;
  /** Number of heuristic-detected duplicates (shows "Dups (N)" button when > 0) */
  suggestedDuplicatesCount?: number;
  /** Handler when the "Dups (N)" button is clicked */
  onSuggestDuplicates?: () => void;
}

/**
 * AG-Grid component with columns dynamically generated from schema
 */
export function SchemaGrid({
  dir = "ltr",
  schema,
  rowData,
  onRowClick,
  showEntityType = false,
  selectionMode = undefined,
  onToggleSelection,
  mode = "search",
  reconciledIds,
  handleContextMenu,
  initialColumnState,
  applyColumnStateTrigger,
  columnStateRef,
  gridApiRef,
  flex1flag = true,
  hasMore = false,
  fetchMoreRemainingCount = 0,
  onFetchMore,
  fetchMoreLoading = false,
  suggestedDuplicatesCount = 0,
  onSuggestDuplicates,
}: SchemaGridProps) {
  const t = useTranslations("search");
  const { isDark } = useTheme();
  const gridRef = useRef<AgGridReact>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenGridRef = useRef<AgGridReact>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [isDownloadingCSV, setIsDownloadingCSV] = useState(false);
  const [isDownloadingMD, setIsDownloadingMD] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Create theme that adapts to dark/light mode using CSS variables
  const gridTheme = useMemo<Theme>(() => {
    return themeQuartz.withParams({
      backgroundColor: "hsl(var(--card))",
      foregroundColor: "hsl(var(--card-foreground))",
      headerBackgroundColor: "hsl(var(--muted))",
      headerTextColor: "hsl(var(--muted-foreground))",
      borderColor: "hsl(var(--border))",
      oddRowBackgroundColor: "hsl(var(--secondary) / 0.15)",
      rowHoverColor: isDark
        ? "hsl(270, 50%, 25%)"
        : "hsl(270, 40%, 95%)",
      selectedRowBackgroundColor: isDark
        ? "hsl(210, 50%, 25%)"
        : "hsl(210, 40%, 95%)",
      fontFamily: "inherit",
      fontSize: 14,
      headerFontSize: 12,
      cellHorizontalPadding: 12,
      headerHeight: 36,
      rowHeight: 40,
    });
  }, [isDark]);

  const getGridColumnState = useCallback((api: GridApi): GridColumnState[] => {
    return api.getColumnState().map((col: ColumnState) => ({
      colId: col.colId || "",
      width: col.width,
      hide: col.hide ?? undefined,
      pinned: col.pinned as "left" | "right" | null,
    }));
  }, []);

  // Expose a function to get current column state via ref (for saving sessions)
  useEffect(() => {
    if (columnStateRef) {
      columnStateRef.current = () => {
        const api = gridRef.current?.api ?? null;
        if (!api) return [];
        return getGridColumnState(api);
      };
    }
    return () => {
      if (columnStateRef) {
        columnStateRef.current = null;
      }
    };
  }, [columnStateRef, getGridColumnState]);

  // Expose grid API ref for external control (e.g., scroll synchronization)
  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      if (gridApiRef) {
        gridApiRef.current = params.api;
      }
      if (initialColumnState && initialColumnState.length > 0) {
        params.api.applyColumnState({
          state: initialColumnState,
          applyOrder: true,
        });
      }
    },
    [gridApiRef, initialColumnState]
  );

  // Apply saved column state when a session is loaded
  useEffect(() => {
    if (!initialColumnState || initialColumnState.length === 0) return;
    if (gridRef.current?.api) {
      gridRef.current.api.applyColumnState({
        state: initialColumnState,
        applyOrder: true,
      });
    }
    if (fullscreenGridRef.current?.api) {
      fullscreenGridRef.current.api.applyColumnState({
        state: initialColumnState,
        applyOrder: true,
      });
    }
  }, [applyColumnStateTrigger, initialColumnState]);

  // Clean up gridApiRef on unmount
  useEffect(() => {
    return () => {
      if (gridApiRef) {
        gridApiRef.current = null;
      }
    };
  }, [gridApiRef]);

  // Generate column definitions from schema
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [];

    // Add checkbox column if in selection mode
    if (selectionMode) {
      cols.push({
        headerName: "",
        colId: "checkbox",
        width: 50,
        checkboxSelection: (params: any) => {
          // Don't show checkbox for sum row
          return !params.data?.isSumRow;
        },
        headerCheckboxSelection: false,
        showDisabledCheckboxes: true,
        lockPosition: "left",
        pinned: "left",
      });
    }

    // Add Date column as the first data column
    cols.push({
      headerName: t("columnDate"),
      field: "data.date",
      colId: "data.date",
      width: 115,
      sortable: true,
      pinned: "left",
      valueGetter: (params) => {
        if (params.data?.isSumRow) return null;
        return params.data?.preview.date || null;
      },
      valueFormatter: (params) =>
        params.value ? formatDate(params.value) : "-",
    });

    // Add Entity Type column when showEntityType is true
    if (showEntityType) {
      cols.push({
        headerName: t("entityType"),
        field: "data._entityDisplayName",
        colId: "data._entityDisplayName",
        width: 150,
        sortable: true,
        pinned: "left",
        valueGetter: (params) => {
          if (params.data?.isSumRow) return null;
          return params.data?.data?._entityDisplayName || "-";
        },
      });
    }

    // Filter schema fields based on mode
    let filteredSchema = schema.filter((field) => {
      // Exclude hidden fields
      if (field.hidden) return false;

      // Exclude date fields that are already covered by the preview.date column
      const isDate =
        field.type === "date" ||
        field.denormalizedAs === "date" ||
        field.name === "date" ||
        field.name === "documentDate";
      if (isDate) return false;

      // Always show important fields
      if (field.isImportant) return true;

      // // In reconcile mode, only show reconcilable fields (+ important)
      // // DISABLED FOR NOW
      // if (mode === "reconcile") {
      //   return field.isReconcilable === true;
      // }

      // In search and browse modes, show all fields
      return true;
    });

    // In reconcile mode, reorder: date first, reconcilable fields, then rest
    if (mode === "reconcile") {
      filteredSchema = filteredSchema.sort((a, b) => {
        // Date fields first
        const aIsDate = a.type === "date" || a.denormalizedAs === "date";
        const bIsDate = b.type === "date" || b.denormalizedAs === "date";
        if (aIsDate && !bIsDate) return -1;
        if (!aIsDate && bIsDate) return 1;

        // Then reconcilable fields (excluding dates already sorted)
        if (!aIsDate && !bIsDate) {
          const aIsReconcilable = a.isReconcilable === true;
          const bIsReconcilable = b.isReconcilable === true;
          if (aIsReconcilable && !bIsReconcilable) return -1;
          if (!aIsReconcilable && bIsReconcilable) return 1;
        }

        // Keep original order for same priority
        return 0;
      });
    }

    // Add columns based on filtered schema fields
    // let dateSortApplied = false;
    for (const field of filteredSchema) {
      const col: ColDef = {
        headerName: field.displayName,
        field: `data.${field.name}`,
        colId: `data.${field.name}`,
        width: 150,
        sortable: true,
      };

      if (field.name === "currency") {
        col.width = 50;
        col.valueGetter = (params) => {
          if (params.data?.isSumRow) return null;
          return getCurrencySymbol(params.data?.data?.currency || "USD");
        };
      } else {
        // Type-specific formatting
        switch (field.type) {
          case "currency":
            col.valueGetter = (params) => {
              // Handle sum row
              if (params.data?.isSumRow) {
                return params.data[`data.${field.name}`];
              }
              const value = params.data?.data?.[field.name];
              if (value === null || value === undefined) return null;
              return Number(value);
            };
            col.cellRenderer = (params: ICellRendererParams) => {
              if (
                params.value === null ||
                params.value === undefined ||
                isNaN(params.value) ||
                !params.value
              ) {
                return <span>-</span>;
              }
              // For sum row, use stored currency code
              let currencyCode = "USD";
              if (params.data?.isSumRow) {
                currencyCode =
                  params.data[`data.${field.name}_currency`] || "USD";
              } else {
                // Get currency from the data field, or preview, or fallback
                const dataCurrency =
                  params.data?.data?.[field.currencyField || "currency"];
                const previewCurrency = params.data?.preview.currency;
                currencyCode =
                  (typeof dataCurrency === "string" ? dataCurrency : null) ||
                  (typeof previewCurrency === "string"
                    ? previewCurrency
                    : null) ||
                  "USD";
              }
              return (
                <FormatCurrency amount={params.value} currency={currencyCode} />
              );
            };
            col.cellStyle = { textAlign: "right", direction: dir };
            col.width = 150;
            break;

          case "number":
            col.valueGetter = (params) => {
              // Handle sum row
              if (params.data?.isSumRow) {
                return params.data[`data.${field.name}`];
              }
              const value = params.data?.data?.[field.name];
              if (value === null || value === undefined) return null;
              return Number(value);
            };
            col.valueFormatter = (params) => {
              if (params.value === null || params.value === undefined)
                return "-";
              return params.value.toLocaleString();
            };
            col.cellStyle = { textAlign: "right", direction: dir };
            break;

          case "date":
            col.valueGetter = (params) => {
              if (params.data?.isSumRow) return null;
              const value = params.data?.data?.[field.name];
              return value || null;
            };
            col.valueFormatter = (params) => {
              if (!params.value) return "-";
              return formatDate(params.value);
            };
            col.width = 150;
            // if (!dateSortApplied) {
            //   col.sort = "desc";
            //   dateSortApplied = true;
            // }
            break;

          case "boolean":
            col.valueGetter = (params) => {
              if (params.data?.isSumRow) return null;
              const value = params.data?.data?.[field.name];
              return value ?? null;
            };
            col.valueFormatter = (params) => {
              if (params.value === null || params.value === undefined)
                return "-";
              return params.value ? "Yes" : "No";
            };
            col.cellStyle = { textAlign: "center", direction: dir };
            col.width = 150;
            break;

          case "enum":
            col.valueGetter = (params) => {
              if (params.data?.isSumRow) return null;
              const value = params.data?.data?.[field.name];
              return value || null;
            };
            col.valueFormatter = (params) => {
              if (!params.value) return "-";
              // Convert ENUM_VALUE to Enum Value
              return params.value
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l: string) => l.toUpperCase());
            };
            break;

          default:
            // text and other types
            col.valueGetter = (params) => {
              if (params.data?.isSumRow) return null;
              const value = params.data?.data?.[field.name];
              return value || null;
            };
            col.cellRenderer = (params: ICellRendererParams) => {
              if (params.value === null || params.value === undefined) {
                return <span>-</span>;
              }
              const strValue = String(params.value);
              // Check if the value is a URL
              if (isUrl(strValue)) {
                return (
                  <a
                    href={strValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {strValue}
                  </a>
                );
              }
              return <span>{strValue}</span>;
            };
        }
      }

      cols.push(col);
    }

    // Adjust the width of the second column to flex 1
    if (flex1flag) {
      var i = 0;
      for (const col of cols) {
        if (i == 1) {
          col.minWidth = 250;
        }

        i++;
      }
    }

    return cols;
  }, [schema, showEntityType, selectionMode, mode, t, flex1flag, dir]);

  // Calculate sums for numeric columns (currency and number types)
  const pinnedBottomRowData = useMemo(() => {
    if (rowData.length === 0) return undefined;

    const sumRow: Record<string, any> = {
      id: "__sum__",
      isSumRow: true, // Flag to identify sum row
    };

    // Calculate sums for each numeric field in the schema
    for (const field of schema) {
      if (field.hidden) continue;

      const colId = `data.${field.name}`;
      let sum = 0;
      let hasValues = false;
      let currencyCode: string | undefined;

      if (field.type === "currency" || field.type === "number") {
        for (const result of rowData) {
          const value = result.data?.[field.name];
          if (value !== null && value !== undefined && !isNaN(Number(value))) {
            sum += Number(value);
            hasValues = true;
            // Store currency code from first result with a value (for currency fields)
            if (field.type === "currency" && !currencyCode) {
              currencyCode =
                (result.data?.[field.currencyField || "currency"] as string) ||
                (result.preview?.currency as string) ||
                "USD";
            }
          }
        }
        sumRow[colId] = hasValues ? sum : null;
        // Store currency code for currency fields
        if (field.type === "currency") {
          sumRow[`${colId}_currency`] = currencyCode || "USD";
        }
      } else {
        // For non-numeric columns, set to null
        sumRow[colId] = null;
      }
    }

    // Handle metadata.date column (non-numeric, show empty)
    sumRow["metadata.date"] = null;

    // Handle checkbox column (non-numeric, show empty)
    if (selectionMode) {
      sumRow["checkbox"] = null;
    }

    // Handle entity type column (non-numeric, show empty)
    if (showEntityType) {
      sumRow["data._entityDisplayName"] = null;
    }

    return [sumRow];
  }, [rowData, schema, selectionMode, showEntityType]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      sortable: true,
      cellStyle: { direction: dir },
    }),
    [dir]
  );

  const getRowClass = useCallback(
    (params: any) => {
      if (params.data?.isSumRow) {
        return "font-bold bg-muted/50";
      }
      if (
        reconciledIds &&
        params.data &&
        reconciledIds.has(params.data.ref?.entityId)
      ) {
        return "bg-green-500/10 hover:bg-green-500/20";
      }
      if (params.data?.data?.isDuplicate === true) {
        return "schema-grid-duplicate-row text-muted-foreground bg-muted/30 italic";
      }
      return undefined;
    },
    [reconciledIds]
  );

  // Redraw rows when reconciledIds changes to update row styling
  useEffect(() => {
    if (gridRef.current?.api && reconciledIds) {
      gridRef.current.api.redrawRows();
    }
    if (fullscreenGridRef.current?.api && reconciledIds) {
      fullscreenGridRef.current.api.redrawRows();
    }
  }, [reconciledIds]);

  // Redraw rows when rowData changes (e.g., after toggling isDuplicate) to refresh styling
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.redrawRows();
    }
    if (fullscreenGridRef.current?.api) {
      fullscreenGridRef.current.api.redrawRows();
    }
  }, [rowData]);

  useEffect(() => {
    const gridEl = containerRef.current;
    if (!gridEl) return;

    const preventBrowserMenu = (e: MouseEvent) => {
      e.preventDefault(); // stop default browser menu
    };

    gridEl.addEventListener("contextmenu", preventBrowserMenu);
    return () => {
      gridEl.removeEventListener("contextmenu", preventBrowserMenu);
    };
  }, []);

  useEffect(() => {
    const gridEl = fullscreenContainerRef.current;
    if (!gridEl) return;

    const preventBrowserMenu = (e: MouseEvent) => {
      e.preventDefault(); // stop default browser menu
    };

    gridEl.addEventListener("contextmenu", preventBrowserMenu);
    return () => {
      gridEl.removeEventListener("contextmenu", preventBrowserMenu);
    };
  }, []);

  const onSelectionChanged = (
    event:
      | RowClickedEvent<any, any>
      | SelectionChangedEvent<any, any>
      | RowSelectedEvent<any, any>
      | RowDoubleClickedEvent<any, any>
  ) => {
    if (!onToggleSelection) return;
    const selectedNodes = event.api.getSelectedNodes().map((node) => node.data);
    onToggleSelection(selectedNodes);
  };

  const handleDownloadCSV = useCallback(async () => {
    // Use the active grid (fullscreen if open, otherwise regular)
    const activeGridRef = isFullscreen ? fullscreenGridRef : gridRef;
    if (!activeGridRef.current?.api || rowData.length === 0) return;
    setIsDownloadingCSV(true);
    try {
      // Use columnDefs from useMemo which has all the valueGetter functions properly set
      exportGridToCSV(columnDefs, rowData, schema);
      toast.success(t("downloadComplete"));
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error(t("downloadFailed"));
    } finally {
      setIsDownloadingCSV(false);
    }
  }, [columnDefs, rowData, schema, t, isFullscreen]);

  const handleDownloadMarkdown = useCallback(async () => {
    // Use the active grid (fullscreen if open, otherwise regular)
    const activeGridRef = isFullscreen ? fullscreenGridRef : gridRef;
    if (!activeGridRef.current?.api || rowData.length === 0) return;
    setIsDownloadingMD(true);
    try {
      // Use columnDefs from useMemo which has all the valueGetter functions properly set
      exportGridToMarkdown(columnDefs, rowData, schema);
      toast.success(t("downloadComplete"));
    } catch (error) {
      console.error("Error exporting Markdown:", error);
      toast.error(t("downloadFailed"));
    } finally {
      setIsDownloadingMD(false);
    }
  }, [columnDefs, rowData, schema, t, isFullscreen]);

  const isDownloading = isDownloadingCSV || isDownloadingMD;

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Render grid component (to avoid duplication)
  const renderGrid = (
    gridRefToUse: React.RefObject<AgGridReact | null>,
    containerRefToUse: React.RefObject<HTMLDivElement | null>,
    testId: string
  ) => (
    <div
      className="h-full w-full bg-background"
      data-testid={testId}
      ref={containerRefToUse}
    >
      <AgGridReact
        theme={gridTheme}
        enableRtl={dir === "rtl"}
        enableCellTextSelection={true}
        ref={gridRefToUse}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        maintainColumnOrder={true}
        rowSelection={selectionMode ? "multiple" : undefined}
        animateRows={true}
        suppressCellFocus={true}
        getRowId={(params) => params.data.ref?.entityId}
        getRowClass={getRowClass}
        onCellContextMenu={handleContextMenu}
        suppressRowClickSelection={true}
        onGridReady={onGridReady}
        pinnedBottomRowData={pinnedBottomRowData}
        onRowSelected={(event) => {
          if (event.source == "checkboxSelected") {
            // console.log("onRowSelected", event);
            if (selectionMode) {
              const isSelected = event.node.isSelected();
              const newSelectMode = !!isSelected; // NOTE from some reason here we need to use !! (ie keep the value)
              if (selectionMode === "single") {
                event.api.deselectAll();
              }
              event.node.setSelected(newSelectMode);
              onSelectionChanged(event);
            }
          }
        }}
        onSelectionChanged={(event) => {
          // console.log("onSelectionChanged", event);
        }}
        onRowDoubleClicked={(event) => {
          console.log("onRowDoubleClicked", event);

          if (selectionMode) {
            const isSelected = event.node.isSelected();
            const newSelectMode = !isSelected; // NOTE from some reason here we need to use ! (ie negeate the value)
            if (selectionMode === "single") {
              event.api.deselectAll();
            }
            event.node.setSelected(newSelectMode);
            onSelectionChanged(event);
          }

          if (!selectionMode && onRowClick && event.data) {
            const result = rowData.find(
              (r) => r.ref?.entityId === event.data.ref?.entityId
            );
            if (result) {
              onRowClick(result);
            }
          }
        }}
      />
    </div>
  );

  // Render toolbar component (to avoid duplication)
  const renderToolbar = (isFullscreenView: boolean) => (
    <div
      className={`flex items-center gap-2 mb-1 absolute bottom-0 left-0 z-10 px-1`}
      data-testid={
        isFullscreenView
          ? "schema-grid-toolbar-fullscreen"
          : "schema-grid-toolbar"
      }
    >
      <Button
        variant="outline"
        size="sm"
        disabled={rowData.length === 0}
        onClick={handleToggleFullscreen}
        data-testid={isFullscreenView ? "minimize-btn" : "expand-btn"}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isFullscreenView ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Expand className="w-4 h-4" />
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isDownloading || rowData.length === 0}
            data-testid="download-btn"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={handleDownloadCSV}
            disabled={isDownloadingCSV || rowData.length === 0}
            data-testid="download-csv-menu-item"
          >
            {isDownloadingCSV ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {t("downloadCSV")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDownloadMarkdown}
            disabled={isDownloadingMD || rowData.length === 0}
            data-testid="download-md-menu-item"
          >
            {isDownloadingMD ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {t("downloadMarkdown")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {hasMore && onFetchMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={onFetchMore}
          disabled={fetchMoreLoading}
          data-testid={
            isFullscreenView
              ? "schema-grid-fetch-more-btn-fullscreen"
              : "schema-grid-fetch-more-btn"
          }
        >
          {fetchMoreLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("loading")}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              {t("fetchMore")}
              {fetchMoreRemainingCount > 0 ? ` (${fetchMoreRemainingCount} ${t("remaining")})` : ""}
            </>
          )}
        </Button>
      )}
      {suggestedDuplicatesCount > 0 && onSuggestDuplicates && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSuggestDuplicates}
          data-testid={
            isFullscreenView
              ? "schema-grid-suggest-dups-btn-fullscreen"
              : "schema-grid-suggest-dups-btn"
          }
        >
          <Copy className="w-4 h-4 mr-2" />
          {`Dups (${suggestedDuplicatesCount})`}
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Regular grid view */}
      <div className="relative w-full h-full">
        {renderToolbar(false)}
        {renderGrid(gridRef, containerRef, "schema-grid")}
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0"
          data-testid="schema-grid-fullscreen-dialog"
        >
          <DialogTitle className="sr-only">
            {t("fullscreenTable") || "Fullscreen Table View"}
          </DialogTitle>
          <div className="relative w-full h-full flex flex-col pt-10">
            {renderToolbar(true)}
            {renderGrid(
              fullscreenGridRef,
              fullscreenContainerRef,
              "schema-grid-fullscreen"
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
