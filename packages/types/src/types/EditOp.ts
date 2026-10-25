/**
 * Edit operation types for anchor-based code editing
 * Used by the generateEdit tool in AI Builder
 */

export type EditOpType = "replace" | "insert_before" | "insert_after" | "delete";

export interface BaseEditOp {
  type: EditOpType;
  /**
   * A stable substring close to where to apply the edit.
   * Typically a function signature, class name, JSX tag, import line, etc.
   */
  anchor: string;
  /**
   * Optional: a smaller "window" constraint so we don't match the wrong anchor.
   * The apply function can search only within this substring if provided.
   */
  anchorContext?: string;
  /**
   * Optional: which occurrence of the anchor to use if it appears multiple times.
   * 0 = first, 1 = second, etc.
   */
  occurrence?: number;
  /**
   * Optional: hints for your UI/logging
   */
  reason?: string;
}

export interface ReplaceEditOp extends BaseEditOp {
  type: "replace";
  /**
   * Exact old text to verify before changing (safety check).
   */
  old?: string;
  /**
   * New text to insert/replace with.
   */
  new?: string | string[];
}

export interface InsertEditOp extends BaseEditOp {
  type: "insert_before" | "insert_after";
  /**
   * New text to insert.
   */
  new: string | string[];
}

export interface DeleteEditOp extends BaseEditOp {
  type: "delete";
  /**
   * Exact old text to delete (required for safety).
   */
  old: string;
}

export type EditOp = ReplaceEditOp | InsertEditOp | DeleteEditOp;

export interface ApplyEditsResult {
  code: string;
  applied: number;
  failures: Array<{ edit: EditOp; error: string }>;
  /**
   * false if validation failed after applying edits
   * undefined/absent if validation passed or not performed
   */
  ok?: boolean;
  /**
   * Validation error messages if code validation failed
   */
  validationErrors?: string[];
}

export interface GenerateEditsResult {
  ok: boolean;
  edits: EditOp[];
}
