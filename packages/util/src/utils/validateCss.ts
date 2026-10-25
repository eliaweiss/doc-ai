import postcss from "postcss";
import type { ValidationResult } from "./validationTypes";

/**
 * Validate CSS syntax using postcss parser
 * @param css - CSS code string to validate
 * @returns Validation result with ok status and any errors
 */
export function validateCss(css: string): ValidationResult {
  // Skip empty CSS
  if (!css.trim()) {
    return { ok: true, errors: [] };
  }

  try {
    postcss.parse(css);
    return { ok: true, errors: [] };
  } catch (e: any) {
    return {
      ok: false,
      errors: [`CSS parse error: ${e.reason || e.message || String(e)}`],
    };
  }
}
