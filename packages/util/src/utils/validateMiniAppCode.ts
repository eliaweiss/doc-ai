import { validateHtml } from "./validateHtml";
import { validateJs } from "./validateJs";
import { validateCss } from "./validateCss";
import { extractInlineScripts } from "./extractInlineScripts";
import { extractInlineStyles } from "./extractInlineStyles";
import type { ValidationResult } from "./validationTypes";

/**
 * Validate Mini App code (HTML with inline CSS and JavaScript)
 * Validates HTML structure, JavaScript syntax, and CSS syntax
 * @param code - Complete HTML code string (may include script and style tags)
 * @returns Validation result with ok status and any errors
 */
export function validateMiniAppCode(code: string): ValidationResult {
  const errors: string[] = [];

  // Validate HTML structure
  const htmlValidation = validateHtml(code);
  if (!htmlValidation.ok) {
    errors.push(...htmlValidation.errors);
  }

  // Extract and validate inline JavaScript
  const scripts = extractInlineScripts(code);
  for (const script of scripts) {
    const jsValidation = validateJs(script);
    if (!jsValidation.ok) {
      errors.push(...jsValidation.errors);
    }
  }

  // Extract and validate inline CSS
  const styles = extractInlineStyles(code);
  for (const style of styles) {
    const cssValidation = validateCss(style);
    if (!cssValidation.ok) {
      errors.push(...cssValidation.errors);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
