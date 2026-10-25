"use client";

import { useCallback } from "react";
import type { EntityResponse, SearchableEntityOption } from "@zdocs/types";
import type { GridApi } from "ag-grid-community";
import { useReconciliation } from "../context/ReconciliationContext";

interface UseAlignWithLinkedParams {
  side: "source" | "target";
  /** The entity option for this pane (selectedEntity for search, currentEntity for browse) */
  paneEntity: SearchableEntityOption | null;
  /** Current pane's results */
  paneResults: EntityResponse[];
  /** Grid API ref for this pane */
  gridApiRef?: React.MutableRefObject<GridApi | null>;
}

interface UseAlignWithLinkedReturn {
  /**
   * Handler to align selection with the linked row on the opposite pane.
   * Call this when user clicks "Align with linked" in context menu.
   */
  handleAlignWithLinked: (contextMenuEntityId: string | undefined) => void;
}

/**
 * Shared hook for the "Align with linked" functionality used in both
 * ReconciliationSearchPane and ReconciliationBrowsePane.
 *
 * This hook finds the linked pair for a given entity and selects/scrolls
 * to show both the source and target rows aligned.
 */
export function useAlignWithLinked({
  side,
  paneEntity,
  paneResults,
  gridApiRef,
}: UseAlignWithLinkedParams): UseAlignWithLinkedReturn {
  const {
    reconciledPairs,
    scrollToAlignSelection,
    setLeftSelection,
    setRightSelection,
    targetResults,
    sourceResults,
    targetEntity,
    sourceEntity,
    targetGridApiRef,
    sourceGridApiRef,
  } = useReconciliation();

  const handleAlignWithLinked = useCallback(
    (contextMenuEntityId: string | undefined) => {
      if (!contextMenuEntityId) {
        return;
      }

      // Find the linked pair for this row
      let linkedTargetId: string | null = null;
      let linkedSourceId: string | null = null;

      if (side === "source") {
        // Find the target linked to this source
        const pair = reconciledPairs.find(
          (p) => p.sourceRef.ref.entityId === contextMenuEntityId
        );
        linkedTargetId = pair?.targetRef.ref.entityId ?? null;
      } else {
        // Find the source linked to this target
        const pair = reconciledPairs.find(
          (p) => p.targetRef.ref.entityId === contextMenuEntityId
        );
        linkedSourceId = pair?.sourceRef.ref.entityId ?? null;
      }

      // Determine which results and entities to use based on side
      let sourceResult: EntityResponse | undefined;
      let targetResult: EntityResponse | undefined;
      let sourceEntityForRef: SearchableEntityOption | null = null;
      let targetEntityForRef: SearchableEntityOption | null = null;
      let sourceGridApi: GridApi | null | undefined;
      let targetGridApi: GridApi | null | undefined;

      if (side === "source" && linkedTargetId) {
        sourceResult = paneResults.find(
          (r) => r.ref.entityId === contextMenuEntityId
        );
        targetResult = targetResults.find(
          (r) => r.ref.entityId === linkedTargetId
        );
        sourceEntityForRef = paneEntity;
        targetEntityForRef = targetEntity;
        sourceGridApi = gridApiRef?.current;
        targetGridApi = targetGridApiRef?.current;
      } else if (side === "target" && linkedSourceId) {
        targetResult = paneResults.find(
          (r) => r.ref.entityId === contextMenuEntityId
        );
        sourceResult = sourceResults.find(
          (r) => r.ref.entityId === linkedSourceId
        );
        sourceEntityForRef = sourceEntity;
        targetEntityForRef = paneEntity;
        sourceGridApi = sourceGridApiRef?.current;
        targetGridApi = gridApiRef?.current;
      }

      if (
        sourceResult &&
        targetResult &&
        sourceEntityForRef &&
        targetEntityForRef
      ) {
        // Select the source row
        setLeftSelection([sourceResult]);

        // Select the target row
        setRightSelection([targetResult]);

        // Also select the rows in the grids
        if (sourceGridApi) {
          sourceGridApi.deselectAll();
          const node = sourceGridApi.getRowNode(sourceResult.ref.entityId);
          node?.setSelected(true);
        }
        if (targetGridApi) {
          targetGridApi.deselectAll();
          const node = targetGridApi.getRowNode(targetResult.ref.entityId);
          node?.setSelected(true);
        }

        // Scroll to align after a small delay
        setTimeout(() => {
          scrollToAlignSelection();
        }, 100);
      }
    },
    [
      side,
      reconciledPairs,
      paneResults,
      targetResults,
      sourceResults,
      paneEntity,
      targetEntity,
      sourceEntity,
      setLeftSelection,
      setRightSelection,
      gridApiRef,
      targetGridApiRef,
      sourceGridApiRef,
      scrollToAlignSelection,
    ]
  );

  return { handleAlignWithLinked };
}
