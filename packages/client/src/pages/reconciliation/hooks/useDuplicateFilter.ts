"use client";

import { useMemo } from "react";
import type { EntityResponse } from "@zdocs/types";

interface UseDuplicateFilterParams {
  /** Unfiltered results from search/browse */
  unfilteredResults: EntityResponse[];
  hideDuplicates: boolean;
  /** Entity IDs that are linked (reconciled) and should never be hidden */
  linkedEntityIds: Set<string>;
}

interface UseDuplicateFilterReturn {
  /** Filtered results with duplicates removed (if hideDuplicates is enabled) */
  filteredResults: EntityResponse[];
}

/**
 * Shared hook for filtering duplicate records in reconciliation panes.
 *
 * When `hideDuplicates` is true, items with `data.isDuplicate === true` are
 * filtered out. Linked (reconciled) items are always kept regardless of the
 * duplicate flag so reconciliation pairs stay visible.
 */
export function useDuplicateFilter({
  unfilteredResults,
  hideDuplicates,
  linkedEntityIds,
}: UseDuplicateFilterParams): UseDuplicateFilterReturn {
  const filteredResults = useMemo(() => {
    if (!hideDuplicates) return unfilteredResults;
    return unfilteredResults.filter(
      (result) =>
        linkedEntityIds.has(result.ref.entityId) ||
        result.data?.isDuplicate !== true
    );
  }, [hideDuplicates, unfilteredResults, linkedEntityIds]);

  return { filteredResults };
}
