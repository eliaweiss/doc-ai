"use client";

import { useMemo } from "react";
import { useReconciliation } from "../context/ReconciliationContext";

interface UseReconciledIdsParams {
  side: "source" | "target";
}

interface UseReconciledIdsReturn {
  /** Set of entity IDs that are reconciled */
  reconciledIds: Set<string>;
}

/**
 * Shared hook to track which entity IDs are reconciled on this pane's side.
 *
 * Syncs with the global reconciledPairs from ReconciliationContext.
 */
export function useReconciledIds({
  side,
}: UseReconciledIdsParams): UseReconciledIdsReturn {
  const { reconciledPairs } = useReconciliation();

  // Use useMemo for synchronous computation to avoid render cycles
  const reconciledIds = useMemo(() => {
    if (side === "source") {
      return new Set(reconciledPairs.map((r) => r.sourceRef.ref.entityId));
    } else {
      return new Set(reconciledPairs.map((r) => r.targetRef.ref.entityId));
    }
  }, [reconciledPairs, side]);

  return { reconciledIds };
}
