import type { ReconciliationPairWithTolerance } from "@zdocs/types";

/**
 * PHASE 3: Detect duplicates across all suggestions
 * Flags any source or target that appears in multiple suggestions
 * Lets the user make the final decision
 */
export function detectDuplicates(suggestions: ReconciliationPairWithTolerance[]): void {
  for (const suggestion of suggestions) {
    for (const suggestion2 of suggestions) {
      if (suggestion === suggestion2) continue;

      if (suggestion.sourceRef.ref.entityId === suggestion2.sourceRef.ref.entityId) {
        suggestion.needManualCheck.push({
          reason: "Duplicate source",
          metadata: { suggestion2 },
        });
      } else if (
        suggestion.targetRef.ref.entityId === suggestion2.targetRef.ref.entityId
      ) {
        suggestion.needManualCheck.push({
          reason: "Duplicate target",
          metadata: { suggestion2 },
        });
      }
    }
  }
}
