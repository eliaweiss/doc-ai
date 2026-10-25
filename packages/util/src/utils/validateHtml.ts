import { parseFragment } from "parse5";
import type { ValidationResult } from "./validationTypes";

/**
 * Check for common HTML syntax errors that would cause issues
 * parse5 is lenient (WHATWG spec), so we do additional checks
 * @param html - HTML string to validate
 * @returns Validation result with ok status and any errors
 */
export function validateHtml(html: string): ValidationResult {
  const errors: string[] = [];

  // Skip empty HTML
  if (!html.trim()) {
    return { ok: true, errors: [] };
  }

  // Check for unclosed tags (basic check)
  // Look for opening tags without matching closing tags
  const openTagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*(?<!\/)>/g;
  const closeTagRegex = /<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/g;
  const selfClosingTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  const openTags: string[] = [];
  let match;

  // Extract open tags (excluding self-closing and void elements)
  while ((match = openTagRegex.exec(html))) {
    const tagName = match[1].toLowerCase();
    if (!selfClosingTags.has(tagName)) {
      openTags.push(tagName);
    }
  }

  // Extract close tags and match with open tags
  const closeTags: string[] = [];
  while ((match = closeTagRegex.exec(html))) {
    closeTags.push(match[1].toLowerCase());
  }

  // Simple validation: check if counts roughly match for common tags
  // This is a heuristic, not a full DOM validation
  const tagCounts = new Map<string, { open: number; close: number }>();

  for (const tag of openTags) {
    const counts = tagCounts.get(tag) || { open: 0, close: 0 };
    counts.open++;
    tagCounts.set(tag, counts);
  }

  for (const tag of closeTags) {
    const counts = tagCounts.get(tag) || { open: 0, close: 0 };
    counts.close++;
    tagCounts.set(tag, counts);
  }

  // Check for mismatched tags
  for (const [tag, counts] of tagCounts) {
    if (counts.open > counts.close) {
      errors.push(
        `HTML error: Unclosed <${tag}> tag (${counts.open} open, ${counts.close} close)`
      );
    } else if (counts.close > counts.open) {
      errors.push(
        `HTML error: Extra closing </${tag}> tag (${counts.open} open, ${counts.close} close)`
      );
    }
  }

  // Try parse5 as a sanity check - it shouldn't throw but let's be safe
  try {
    parseFragment(html);
  } catch (e: any) {
    errors.push(`HTML parse error: ${e.message || String(e)}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
