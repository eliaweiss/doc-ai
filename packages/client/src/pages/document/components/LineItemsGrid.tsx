"use client";

import { useMemo, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, Globe } from "lucide-react";
import { FieldDefinition } from "@zdocs/types";
import { formatCurrency, getCurrencySymbol } from "@zdocs/util";
import {
  ColDef,
  CellEditingStoppedEvent,
  ColumnMovedEvent,
  ColumnResizedEvent,
  ColumnState,
  GridReadyEvent,
  GridApi,
  CellStyle,
  CellContextMenuEvent,
} from "ag-grid-community";
import { DataGrid } from "@zdocs/client-component";
import { ContextMenu } from "@zdocs/client-component";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

const rightAlignStyle: CellStyle = { textAlign: "right" };

export interface LineItemEdit {
  id: string;
  originalData: Record<string, unknown>;
  editedData: Partial<Record<string, unknown>>;
}

interface LineItemsGridProps {
  lineItems: Record<string, unknown>[];
  lineItemSchema: FieldDefinition[];
  currency: string | null;
  t: (key: string) => string;
  onEditChange?: (edits: Map<string, LineItemEdit>) => void;
  onAutoSave?: () => void;
  editsRef?: React.MutableRefObject<Map<string, LineItemEdit>>;
  gridApiRef?: React.MutableRefObject<GridApi<Record<string, unknown>> | null>;
  initialColumnState?: ColumnState[];
  onColumnStateChange?: (columnState: ColumnState[]) => void;
  documentId?: string;
}

export function LineItemsGrid({
  lineItems,
  lineItemSchema,
  currency,
  t,
  onEditChange,
  onAutoSave,
  editsRef,
  gridApiRef: externalGridApiRef,
  initialColumnState,
  onColumnStateChange,
  documentId,
}: LineItemsGridProps) {
  const router = useRouter();
  const { logEvent } = useLogUserJourneyEvent();
  const internalGridApiRef = useRef<GridApi<Record<string, unknown>> | null>(
    null
  );
  const gridApiRef = externalGridApiRef || internalGridApiRef;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    lineItem: Record<string, unknown> | null;
  }>({ show: false, x: 0, y: 0, lineItem: null });

  const handleCellEditingStopped = useCallback(
    (event: CellEditingStoppedEvent<Record<string, unknown>>) => {
      if (!event.data || event.oldValue === event.newValue) return;
      if (!editsRef || !onEditChange) return;

      const rowId = event.data.id as string;
      const field = event.colDef.field as string;

      logEvent({
        eventType: "document_line_item_cell_edited",
        eventData: {
          documentId,
          lineItemId: rowId,
          fieldName: field,
        },
      });

      const newMap = new Map(editsRef.current);
      const existing = newMap.get(rowId);

      if (existing) {
        existing.editedData[field] = event.newValue;
      } else {
        newMap.set(rowId, {
          id: rowId,
          originalData: { ...event.data },
          editedData: { [field]: event.newValue },
        });
      }

      editsRef.current = newMap;
      onEditChange(newMap);
      
      // Trigger autosave on blur
      onAutoSave?.();
    },
    [editsRef, onEditChange, onAutoSave, documentId, logEvent]
  );

  // Generate columns dynamically from schema
  const columnDefs = useMemo<ColDef<Record<string, unknown>>[]>(() => {
    return lineItemSchema.map((field) => {
      const isNumeric = field.type === "number" || field.type === "currency";
      const defaultFlex =
        field.type === "text" && field.name.includes("description") ? 2 : 1;
      const defaultMinWidth = isNumeric ? 100 : 80;

      const colDef: ColDef<Record<string, unknown>> = {
        field: field.name,
        headerName: field.displayName || field.name,
        width: field.width,
        flex: field.width !== undefined ? undefined : (field.flex ?? defaultFlex),
        minWidth: field.minWidth ?? defaultMinWidth,
        pinned: field.pinned,
        editable: true,
        cellStyle: isNumeric ? rightAlignStyle : undefined,
        headerClass: isNumeric ? "ag-right-aligned-header" : undefined,
        cellClass: "editable-cell",
        valueGetter: (params) => {
          const value = params.data?.[field.name];
          if (value === null || value === undefined) return "";
          return value;
        },
        valueSetter: (params) => {
          if (params.data) {
            let newValue: unknown = params.newValue;
            // Convert to appropriate type
            if (isNumeric && params.newValue) {
              newValue = parseFloat(params.newValue) || null;
            }
            params.data[field.name] = newValue || null;
          }
          return true;
        },
      };

      // Add formatters for currency and number fields
      if (field.type === "currency") {
        colDef.valueFormatter = (params) =>
          params.value === "" ||
          params.value === null ||
          isNaN(params.value) ||
          !params.value // ie, zero value
            ? "-"
            : formatCurrency(params.value);
        colDef.comparator = (a, b) =>
          (parseFloat(a) || 0) - (parseFloat(b) || 0);
      } else if (field.type === "number") {
        colDef.comparator = (a, b) =>
          (parseFloat(a) || 0) - (parseFloat(b) || 0);
      }

      return colDef;
    });
  }, [lineItemSchema]);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Record<string, unknown>>) => {
      gridApiRef.current = event.api;

      const schemaColumnState: ColumnState[] = lineItemSchema
        .map((field) => ({
          colId: field.name,
          width: field.width,
          pinned: field.pinned,
        }))
        .filter((column) => column.width !== undefined || column.pinned !== undefined);

      const stateToApply = initialColumnState?.length
        ? initialColumnState
        : schemaColumnState;

      if (stateToApply.length) {
        event.api.applyColumnState({
          state: stateToApply,
          applyOrder: true,
        });
      }
    },
    [gridApiRef, initialColumnState, lineItemSchema]
  );

  const handleColumnMoved = useCallback(
    (event: ColumnMovedEvent<Record<string, unknown>>) => {
      if (!onColumnStateChange || !event.finished) return;
      onColumnStateChange(event.api.getColumnState());
    },
    [onColumnStateChange]
  );

  const handleColumnResized = useCallback(
    (event: ColumnResizedEvent<Record<string, unknown>>) => {
      if (!onColumnStateChange || !event.finished) return;
      onColumnStateChange(event.api.getColumnState());
    },
    [onColumnStateChange]
  );

  // Handle right-click context menu
  const handleCellContextMenu = useCallback(
    (event: CellContextMenuEvent<Record<string, unknown>>) => {
      event.event?.preventDefault();
      const mouseEvent = event.event as MouseEvent;
      if (event.data) {
        setContextMenu({
          show: true,
          x: mouseEvent.pageX,
          y: mouseEvent.pageY,
          lineItem: event.data,
        });
      }
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0, lineItem: null });
  }, []);

  // Get a searchable text from the line item (description or first text field)
  const getSearchableText = useCallback(
    (lineItem: Record<string, unknown>): string | null => {
      // Try common description field names
      const descriptionFields = [
        "description",
        "name",
        "itemName",
        "productName",
      ];
      for (const fieldName of descriptionFields) {
        if (lineItem[fieldName] && typeof lineItem[fieldName] === "string") {
          return lineItem[fieldName] as string;
        }
      }
      // Find first text field from schema
      const textField = lineItemSchema.find((f) => f.type === "text");
      if (textField && lineItem[textField.name]) {
        return lineItem[textField.name] as string;
      }
      return null;
    },
    [lineItemSchema]
  );

  const handleSearchByName = useCallback(() => {
    const searchText = contextMenu.lineItem
      ? getSearchableText(contextMenu.lineItem)
      : null;
    if (searchText) {
      logEvent({
        eventType: "document_line_item_context_search_by_name",
        eventData: {
          documentId,
          lineItemId: contextMenu.lineItem?.id as string,
        },
      });
      router.push(`/search?q=${encodeURIComponent(searchText)}`);
    }
    closeContextMenu();
  }, [contextMenu.lineItem, router, closeContextMenu, getSearchableText, documentId, logEvent]);

  const handleSearchBySku = useCallback(() => {
    const sku = contextMenu.lineItem?.sku as string | undefined;
    if (sku) {
      logEvent({
        eventType: "document_line_item_context_search_by_sku",
        eventData: {
          documentId,
          lineItemId: contextMenu.lineItem?.id as string,
        },
      });
      router.push(`/search?q=${encodeURIComponent(sku)}`);
    }
    closeContextMenu();
  }, [contextMenu.lineItem, router, closeContextMenu, documentId, logEvent]);

  const handleSearchInGoogle = useCallback(() => {
    if (contextMenu.lineItem) {
      const searchText = getSearchableText(contextMenu.lineItem);
      const price =
        (contextMenu.lineItem.amount as number) ||
        (contextMenu.lineItem.unitPrice as number);
      const parts: string[] = [];

      if (searchText) parts.push(searchText);

      if (parts.length > 0) {
        logEvent({
          eventType: "document_line_item_context_search_google",
          eventData: {
            documentId,
            lineItemId: contextMenu.lineItem.id as string,
          },
        });
        const query = parts.join(" ");
        window.open(
          `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          "_blank"
        );
      }
    }
    closeContextMenu();
  }, [contextMenu.lineItem, closeContextMenu, getSearchableText, documentId, logEvent]);

  // Prevent browser context menu on the grid container
  const handleContainerContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  if (lineItems.length === 0) {
    return null;
  }

  const searchableText = contextMenu.lineItem
    ? getSearchableText(contextMenu.lineItem)
    : null;
  const hasSku = Boolean(contextMenu.lineItem?.sku);

  return (
    <>
      <div
        className="h-full min-h-0 overflow-hidden rounded-lg border border-border"
        data-testid="line-items-grid"
        onContextMenu={handleContainerContextMenu}
      >
        <style>{`
          .editable-cell {
            cursor: pointer;
          }
          .editable-cell:hover {
            background-color: var(--accent) !important;
          }
          .ag-cell-inline-editing {
            background-color: var(--background) !important;
            border: 1px solid var(--primary) !important;
          }
        `}</style>
        <DataGrid<Record<string, unknown>>
          rowData={lineItems}
          columnDefs={columnDefs}
          containerClassName="h-full min-h-0"
          sizeColumnsToFitOnReady={false}
          domLayout="normal"
          getRowId={(params) => params.data.id as string}
          defaultColDef={{ sortingOrder: ["desc", "asc"] }}
          onCellEditingStopped={handleCellEditingStopped}
          onGridReady={handleGridReady}
          onColumnMoved={handleColumnMoved}
          onColumnResized={handleColumnResized}
          onCellContextMenu={handleCellContextMenu}
          maintainColumnOrder
          stopEditingWhenCellsLoseFocus
          singleClickEdit
        />
      </div>

      {/* Context Menu */}
      {contextMenu.show && contextMenu.lineItem && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        >
          {searchableText && (
            <button
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
              onClick={handleSearchByName}
              data-testid="lineitem-context-search-by-name"
            >
              <Search className="w-4 h-4 mr-2" />
              {t("searchByName")}
            </button>
          )}
          {hasSku && (
            <button
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
              onClick={handleSearchBySku}
              data-testid="lineitem-context-search-by-sku"
            >
              <Package className="w-4 h-4 mr-2" />
              {t("searchBySku")}
            </button>
          )}
          {Boolean(
            searchableText ||
              contextMenu.lineItem.amount ||
              contextMenu.lineItem.unitPrice
          ) && (
            <button
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
              onClick={handleSearchInGoogle}
              data-testid="lineitem-context-search-google"
            >
              <Globe className="w-4 h-4 mr-2" />
              {t("searchInGoogle")}
            </button>
          )}
        </ContextMenu>
      )}
    </>
  );
}
