/**
 * Extract inline CSS code from HTML style tags
 * @param html - HTML string containing style tags
 * @returns Array of CSS code strings from style tags
 */
export function extractInlineStyles(html: string): string[] {
  const styles: string[] = [];
  const regex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const content = match[1];
    // Only add non-empty content
    if (content.trim()) {
      styles.push(content);
    }
  }
  return styles;
}
