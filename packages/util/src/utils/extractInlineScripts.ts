/**
 * Extract inline JavaScript code from HTML script tags
 * Skips external scripts (those with src attribute)
 * @param html - HTML string containing script tags
 * @returns Array of JavaScript code strings from inline script tags
 */
export function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  // Match script tags and capture attributes and content
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const attributes = match[1];
    const content = match[2];
    // Skip external scripts (those with src attribute)
    if (/\bsrc\s*=/i.test(attributes)) {
      continue;
    }
    // Only add non-empty content
    if (content.trim()) {
      scripts.push(content);
    }
  }
  return scripts;
}
