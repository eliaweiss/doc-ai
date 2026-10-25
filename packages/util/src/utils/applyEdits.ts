import type { EditOp, ApplyEditsResult } from "@zdocs/types";
import { validateMiniAppCode } from "./validateMiniAppCode";
import { validateJs } from "./validateJs";

/**
 * Process escape sequences in a string (e.g., \n -> actual newline)
 * Handles common escape sequences: \n, \t, \r, \\
 */
function processEscapeSequences(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

/**
 * Normalize new text from string or array of lines to a single string
 * Processes escape sequences in string format (e.g., \n becomes actual newline)
 */
function normalizeNewText(v?: string | string[]): string {
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v.join("\n");
  }
  // Process escape sequences in string format
  return processEscapeSequences(v);
}

/**
 * Find the nth occurrence of a needle in a haystack
 * @returns Index of the nth occurrence, or -1 if not found
 */
function findNthIndex(haystack: string, needle: string, n: number): number {
  if (!needle) return -1;
  let idx = -1;
  let from = 0;
  for (let i = 0; i <= n; i++) {
    idx = haystack.indexOf(needle, from);
    if (idx === -1) return -1;
    from = idx + needle.length;
  }
  return idx;
}

/**
 * Find the index of old text relative to an anchor position.
 * Handles cases where old text includes the anchor (with possible leading characters)
 * or appears after the anchor.
 * @param code - The code to search in
 * @param old - The old text to find
 * @param anchor - The anchor string
 * @param anchorIdx - The index where the anchor was found
 * @returns The index where old text starts, or -1 if not found
 */
function findOldTextIndex(
  code: string,
  old: string,
  anchor: string,
  anchorIdx: number
): number {
  // Check if old includes the anchor - if so, adjust search position
  const anchorPosInOld = old.indexOf(anchor);
  const startSearch =
    anchorPosInOld !== -1
      ? Math.max(0, anchorIdx - anchorPosInOld) // Back up to where old should start
      : anchorIdx; // Fall back to searching from anchor position
  return code.indexOf(old, startSearch);
}

export type ValidationMode = "html" | "js" | "none";

export interface ApplyEditsOptions {
  /**
   * Validation mode to use after applying edits.
   * - "html": Validates as Mini App code (HTML with inline JS/CSS)
   * - "js": Validates as pure JavaScript code
   * - "none": No validation (default, for backward compatibility)
   */
  validate?: ValidationMode;
}

/**
 * Apply anchor-based edits safely.
 * - Finds anchor (optionally within anchorContext)
 * - Verifies "old" if provided (recommended for replace/delete)
 * - Applies change deterministically
 * - Optionally validates the result (HTML+JS+CSS or JS only)
 *
 * @param code - The current code to apply edits to
 * @param edits - Array of edit operations to apply
 * @param options - Optional settings (e.g., validation mode)
 * @returns Result with updated code, count of applied edits, and any failures
 */
export function applyEdits(
  code: string,
  edits: EditOp[],
  options?: ApplyEditsOptions
): ApplyEditsResult {
  let next = code;
  const failures: Array<{ edit: EditOp; error: string }> = [];
  let applied = 0;

  for (const raw of edits) {
    const edit: EditOp = { occurrence: 0, ...raw } as EditOp;

    const occurrence = edit.occurrence ?? 0;
    const anchorContext = edit.anchorContext;

    // Choose the search space
    let space = next;
    let spaceOffset = 0;

    if (anchorContext) {
      const ctxIdx = next.indexOf(anchorContext);
      if (ctxIdx === -1) {
        failures.push({ edit, error: "anchorContext not found" });
        continue;
      }
      space = next.slice(ctxIdx, ctxIdx + anchorContext.length);
      spaceOffset = ctxIdx;
    }

    const anchorIdxInSpace = findNthIndex(space, edit.anchor, occurrence);
    if (anchorIdxInSpace === -1) {
      failures.push({ edit, error: "anchor not found" });
      continue;
    }

    const anchorIdx = spaceOffset + anchorIdxInSpace;

    const newText = normalizeNewText((edit as { new?: string | string[] }).new);

    if (edit.type === "insert_before") {
      next = next.slice(0, anchorIdx) + newText + next.slice(anchorIdx);
      applied++;
      continue;
    }

    if (edit.type === "insert_after") {
      const afterIdx = anchorIdx + edit.anchor.length;
      next = next.slice(0, afterIdx) + newText + next.slice(afterIdx);
      applied++;
      continue;
    }

    if (edit.type === "replace") {
      // If old is provided, replace the first occurrence of old near the anchor (safer)
      if (edit.old) {
        // Process escape sequences in old text (e.g., \n -> actual newline)
        const processedOld = processEscapeSequences(edit.old);
        const oldIdx = findOldTextIndex(next, processedOld, edit.anchor, anchorIdx);
        if (oldIdx === -1) {
          failures.push({ edit, error: '"old" text not found near anchor' });
          continue;
        }
        next =
          next.slice(0, oldIdx) +
          newText +
          next.slice(oldIdx + processedOld.length);
        applied++;
      } else {
        // Fallback: replace the anchor itself (less safe)
        next =
          next.slice(0, anchorIdx) +
          newText +
          next.slice(anchorIdx + edit.anchor.length);
        applied++;
      }
      continue;
    }

    if (edit.type === "delete") {
      if (!edit.old) {
        failures.push({ edit, error: 'delete requires "old" text for safety' });
        continue;
      }
      // Process escape sequences in old text (e.g., \n -> actual newline)
      const processedOld = processEscapeSequences(edit.old);
      const oldIdx = findOldTextIndex(next, processedOld, edit.anchor, anchorIdx);
      if (oldIdx === -1) {
        failures.push({ edit, error: '"old" text not found near anchor' });
        continue;
      }
      next = next.slice(0, oldIdx) + next.slice(oldIdx + processedOld.length);
      applied++;
      continue;
    }

    failures.push({ edit, error: "unknown edit type" });
  }

  // Optionally validate the resulting code after all edits are applied
  const validationMode = options?.validate ?? "none";

  if (validationMode === "html") {
    const validation = validateMiniAppCode(next);
    if (!validation.ok) {
      // Return early with validation errors - edits were applied but code is invalid
      return {
        ok: false,
        code: next, // Still include code so AI can see what was attempted
        applied: 0, // No edit applied (validation failed)
        failures: failures,
        validationErrors: validation.errors,
      };
    }
  } else if (validationMode === "js") {
    const validation = validateJs(next);
    if (!validation.ok) {
      // Return early with validation errors - edits were applied but code is invalid
      return {
        ok: false,
        code: next, // Still include code so AI can see what was attempted
        applied: 0, // No edit applied (validation failed)
        failures: failures,
        validationErrors: validation.errors,
      };
    }
  }

  // Validation passed (or not requested) - return normal result
  return { code: next, applied, failures };
}
