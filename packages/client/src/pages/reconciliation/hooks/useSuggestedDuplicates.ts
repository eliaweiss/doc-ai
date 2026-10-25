"use client";

import { useMemo } from "react";
import type { EntityResponse, FieldDefinition } from "@zdocs/types";
import { isZdocsDuplicate } from "@zdocs/util";

export interface DuplicateGroup {
  /** The first (kept) item in the group */
  original: EntityResponse;
  /** Items that are heuristic-duplicates of the original */
  duplicates: EntityResponse[];
}

/**
 * Detect groups of heuristic-duplicate items among the current results.
 *
 * Only items that are NOT already flagged `isDuplicate` are considered as
 * potential originals. Items already flagged are skipped entirely.
 *
 * Returns an array of groups, each with one original and one or more duplicates.
 */
export function useSuggestedDuplicates(
  results: EntityResponse[],
  schema: FieldDefinition[]
): { groups: DuplicateGroup[]; totalDuplicateCount: number } {
  return useMemo(() => {
    if (results.length === 0 || schema.length === 0) {
      return { groups: [], totalDuplicateCount: 0 };
    }

    const groups: DuplicateGroup[] = [];
    const assignedEntityIds = new Set<string>();

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (item.data?.isDuplicate === true) continue;
      if (assignedEntityIds.has(item.ref.entityId)) continue;

      const duplicates: EntityResponse[] = [];

      for (let j = i + 1; j < results.length; j++) {
        const other = results[j];
        if (other.data?.isDuplicate === true) continue;
        if (assignedEntityIds.has(other.ref.entityId)) continue;

        if (isZdocsDuplicate(item, other, schema)) {
          duplicates.push(other);
          assignedEntityIds.add(other.ref.entityId);
        }
      }

      if (duplicates.length > 0) {
        assignedEntityIds.add(item.ref.entityId);
        groups.push({ original: item, duplicates });
      }
    }

    const totalDuplicateCount = groups.reduce(
      (sum, g) => sum + g.duplicates.length,
      0
    );

    return { groups, totalDuplicateCount };
  }, [results, schema]);
}
