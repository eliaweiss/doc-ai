"use client";

import { useCallback, useMemo } from "react";
import { AgGridReact, AgGridReactProps } from "ag-grid-react";
import {
  ColDef,
  GridReadyEvent,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  Theme,
} from "ag-grid-community";

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

// Base theme params that match the app's CSS variables
const baseThemeParams = {
  backgroundColor: "hsl(var(--background))",
  foregroundColor: "hsl(var(--card-foreground))",
  headerBackgroundColor: "hsl(var(--muted))",
  headerTextColor: "hsl(var(--muted-foreground))",
  borderColor: "hsl(var(--border))",
  oddRowBackgroundColor: "hsl(var(--secondary))",
  rowHoverColor: "hsl(var(--accent))",
  selectedRowBackgroundColor: "hsl(var(--border))",
  fontFamily: "inherit",
  fontSize: 14,
  headerFontSize: 12,
  cellHorizontalPadding: 12,
  headerHeight: 36,
  rowHeight: 40,
};

// Default custom theme
const customTheme = themeQuartz.withParams(baseThemeParams);

// Create a theme with custom selection color
export const createSelectionTheme = (selectionColor: string) =>
  themeQuartz.withParams({
    ...baseThemeParams,
    selectedRowBackgroundColor: selectionColor,
  });

export interface DataGridProps<T = unknown>
  extends Omit<AgGridReactProps<T>, "theme"> {
  containerClassName?: string;
  /** Custom theme override */
  customTheme?: Theme;
  /** Auto-fit columns to container width on grid ready */
  sizeColumnsToFitOnReady?: boolean;
}

export function DataGrid<T = unknown>({
  containerClassName = "",
  columnDefs,
  rowData,
  defaultColDef,
  onGridReady,
  customTheme: themeOverride,
  sizeColumnsToFitOnReady = true,
  ...props
}: DataGridProps<T>) {
  const gridTheme = themeOverride || customTheme;
  const mergedDefaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      ...defaultColDef,
    }),
    [defaultColDef]
  );

  const handleGridReady = useCallback(
    (event: GridReadyEvent<T>) => {
      if (sizeColumnsToFitOnReady) {
        event.api.sizeColumnsToFit();
      }
      onGridReady?.(event);
    },
    [onGridReady, sizeColumnsToFitOnReady]
  );

  return (
    <div
      className={`w-full h-full ${containerClassName}`}
      data-testid="data-grid-container"
    >
      <AgGridReact<T>
        theme={gridTheme}
        columnDefs={columnDefs}
        rowData={rowData}
        defaultColDef={mergedDefaultColDef}
        onGridReady={handleGridReady}
        domLayout="autoHeight"
        suppressCellFocus
        animateRows
        enableCellTextSelection
        ensureDomOrder
        {...props}
      />
    </div>
  );
}
