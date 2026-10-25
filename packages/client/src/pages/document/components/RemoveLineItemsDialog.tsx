"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { FieldDefinition } from "@zdocs/types";
import { formatCurrency } from "@zdocs/util";
import { Button, DataGrid } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { ColDef, RowClickedEvent } from "ag-grid-community";
import { useConfirm } from "packages/client/src/context-providers/confirm-provider/ConfirmProvider";
import { getEditableLineItemFields } from "./lineItemActionUtils";

interface RemoveLineItemsDialogProps {
  open: boolean;
  collectionDisplayName: string;
  lineItems: Record<string, unknown>[];
  lineItemSchema: FieldDefinition[];
  isSaving: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onOpenChange: (open: boolean) => void;
  onRemove: (rowIds: string[]) => Promise<void>;
}

interface SelectableLineItem extends Record<string, unknown> {
  __lineItemRowId: string;
}

const markerColumnWidth = 64;

export function RemoveLineItemsDialog({
  open,
  collectionDisplayName,
  lineItems,
  lineItemSchema,
  isSaving,
  t,
  onOpenChange,
  onRemove,
}: RemoveLineItemsDialogProps) {
  const confirm = useConfirm();
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelectedRowIds(new Set());
    }
  }, [open]);

  const rowData = useMemo<SelectableLineItem[]>(
    () =>
      lineItems.map((item, index) => ({
        ...item,
        __lineItemRowId:
          typeof item.id === "string" ? item.id : `line-item-${index}`,
      })),
    [lineItems]
  );

  const columnDefs = useMemo<ColDef<SelectableLineItem>[]>(() => {
    const markerColumn: ColDef<SelectableLineItem> = {
      colId: "__deleteMarker",
      headerName: "",
      width: markerColumnWidth,
      minWidth: markerColumnWidth,
      maxWidth: markerColumnWidth,
      sortable: false,
      resizable: false,
      cellRenderer: ({ data }: { data?: SelectableLineItem }) =>
        data && selectedRowIds.has(data.__lineItemRowId) ? (
          <span className="flex h-full items-center justify-center text-red-500"
            data-testid="remove-line-items-delete-marker"
          >
            <X className="h-8 w-8" />
          </span>
        ) : null,
    };

    const schemaColumns = getEditableLineItemFields(lineItemSchema).map(
      (field) => {
        const isNumeric = field.type === "number" || field.type === "currency";
        const colDef: ColDef<SelectableLineItem> = {
          field: field.name,
          headerName: field.displayName || field.name,
          width: field.width,
          flex: field.width !== undefined ? undefined : (field.flex ?? 1),
          minWidth: field.minWidth ?? (isNumeric ? 100 : 120),
          cellStyle: isNumeric ? { textAlign: "right" } : undefined,
          headerClass: isNumeric ? "ag-right-aligned-header" : undefined,
          valueGetter: (params) => {
            const value = params.data?.[field.name];
            return value === null || value === undefined ? "" : value;
          },
        };

        if (field.type === "currency") {
          colDef.valueFormatter = (params) =>
            params.value === "" ||
              params.value === null ||
              Number.isNaN(Number(params.value))
              ? "-"
              : formatCurrency(Number(params.value));
        }

        return colDef;
      }
    );

    return [markerColumn, ...schemaColumns];
  }, [lineItemSchema, selectedRowIds]);

  const handleRowClicked = (event: RowClickedEvent<SelectableLineItem>) => {
    if (!event.data) return;
    const rowId = event.data.__lineItemRowId;

    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleRemove = async () => {
    if (selectedRowIds.size === 0) return;

    const ok = await confirm({
      title: t("removeLineItemsConfirmTitle"),
      message: t("removeLineItemsConfirmMessage", {
        count: selectedRowIds.size,
      }),
      confirmLabel: t("remove"),
      cancelLabel: t("cancel"),
    });

    if (!ok) return;

    await onRemove(Array.from(selectedRowIds));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[85vh] flex-col sm:max-w-5xl"
        data-testid="remove-line-items-dialog"
      >
        <DialogHeader data-testid="remove-line-items-dialog-header">
          <DialogTitle>{t("removeLineItemsDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("removeLineItemsDialogDescription", {
              collection: collectionDisplayName,
            })}
          </DialogDescription>
        </DialogHeader>

        <div
          className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border"
          data-testid="remove-line-items-table"
        >
          <DataGrid<SelectableLineItem>
            rowData={rowData}
            columnDefs={columnDefs}
            containerClassName="h-full min-h-0"
            sizeColumnsToFitOnReady={false}
            domLayout="normal"
            getRowId={(params) => params.data.__lineItemRowId}
            onRowClicked={handleRowClicked}
            rowClassRules={{
              "bg-destructive/10": (params) =>
                Boolean(
                  params.data &&
                  selectedRowIds.has(params.data.__lineItemRowId)
                ),
            }}
            suppressCellFocus
          />
        </div>

        <DialogFooter data-testid="remove-line-items-dialog-footer">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            data-testid="remove-line-items-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRemove}
            disabled={isSaving || selectedRowIds.size === 0}
            data-testid="remove-line-items-submit-btn"
          >
            {isSaving
              ? t("removingLineItems")
              : t("removeLineItemsSelected", { count: selectedRowIds.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
