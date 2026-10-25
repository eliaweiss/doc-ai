/**
 * Determines if a color is light or dark
 * Returns true if the color is light (should use dark text), false if dark (should use light text)
 */
export function isLightColor(hex: string): boolean {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Convert hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Calculate relative luminance (perceived brightness)
  // Using the formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // If luminance is greater than 0.5, it's a light color
  return luminance > 0.5;
}

/**
 * Gets the appropriate text color (black or white) based on background color brightness
 */
export function getTextColorForBackground(hex: string): string {
  return isLightColor(hex) ? "#000000" : "#ffffff";
}
