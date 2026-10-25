"use client";

import { EntityResponse } from "@zdocs/types";
import { useState, useCallback } from "react";

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  documentId: string | null;
  entityId: string | null;
  /** Whether this entity is currently marked as duplicate (read from item data) */
  isDuplicate: boolean;
  /** Whether this is a line item (only line items can be marked as duplicates) */
  isLineItem: boolean;
}

interface UseContextMenuStateReturn {
  /** Current context menu state */
  contextMenu: ContextMenuState;
  /** Open the context menu at the specified position with the given item data */
  openContextMenu: (
    x: number,
    y: number,
    documentId: string,
    entityId: string,
    isDuplicate: boolean,
    isLineItem: boolean
  ) => void;
  /** Close the context menu */
  closeContextMenu: () => void;
  /** Update isDuplicate on the open menu (used after toggling) */
  updateContextMenuDuplicate: (isDuplicate: boolean) => void;
  /** Handler for AG Grid cell context menu event */
  handleCellContextMenu: (params: {
    event?: MouseEvent | null;
    data?: Record<string, unknown>;
  }) => void;
}

/**
 * Shared hook for managing context menu state in reconciliation panes.
 *
 * Provides state management and handlers for the right-click context menu
 * used in SchemaGrid components.
 */
export function useContextMenuState(): UseContextMenuStateReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    documentId: null,
    entityId: null,
    isDuplicate: false,
    isLineItem: false,
  });

  const openContextMenu = useCallback(
    (
      x: number,
      y: number,
      documentId: string,
      entityId: string,
      isDuplicate: boolean,
      isLineItem: boolean
    ) => {
      setContextMenu({
        show: true,
        x,
        y,
        documentId,
        entityId,
        isDuplicate,
        isLineItem,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      documentId: null,
      entityId: null,
      isDuplicate: false,
      isLineItem: false,
    });
  }, []);

  const updateContextMenuDuplicate = useCallback((isDuplicate: boolean) => {
    setContextMenu((prev) => ({ ...prev, isDuplicate }));
  }, []);

  const handleCellContextMenu = useCallback(
    (params: { event?: MouseEvent | null; data?: Record<string, unknown> }) => {
      params.event?.preventDefault();
      const mouseEvent = params.event;
      if (params.data && mouseEvent) {
        const data = params.data as unknown as EntityResponse;
        const documentId = data.ref.documentId;
        const entityId = data.ref.entityId;
        const isLineItem = data.ref.entityType === "LINE_ITEM";
        const isDuplicate = data.data?.isDuplicate === true;
        if (documentId && entityId) {
          openContextMenu(
            mouseEvent.pageX,
            mouseEvent.pageY,
            documentId,
            entityId,
            isDuplicate,
            isLineItem
          );
        }
      }
    },
    [openContextMenu]
  );

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    updateContextMenuDuplicate,
    handleCellContextMenu,
  };
}
