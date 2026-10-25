import type { ValidationResult } from "./validationTypes";

/**
 * Validate JavaScript syntax using Function constructor
 * Catches ~90% of syntax errors that would cause runtime crashes
 * @param jsCode - JavaScript code string to validate
 * @returns Validation result with ok status and any errors
 */
export function validateJs(jsCode: string): ValidationResult {
  // Skip empty code
  if (!jsCode.trim()) {
    return { ok: true, errors: [] };
  }

  try {
    // Use Function constructor to validate syntax without executing
    new Function(jsCode);
    return { ok: true, errors: [] };
  } catch (e: any) {
    return {
      ok: false,
      errors: [`JS SyntaxError: ${e.message || String(e)}`],
    };
  }
}
