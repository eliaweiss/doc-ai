import type { LucideIcon } from "lucide-react";
import type { SystemApp } from "../utils/systemApps";
import type { MiniApp } from "@zdocs/types";

/**
 * Unified app item type that works for both system apps and mini apps
 */
export interface AppItem {
  id: string;
  name: string;
  path: string;
  mode: string;
  // Icon can be either a LucideIcon component (system apps) or icon name string (mini apps)
  icon?: LucideIcon;
  iconName?: string | null;
  color?: string | null;
  isMiniApp: boolean;
}

/**
 * Check if a color string is a valid hex color
 */
export const isValidHexColor = (color: string | null | undefined): boolean => {
  return !!color && /^#[0-9A-Fa-f]{6}$/.test(color);
};

/**
 * Convert a SystemApp to an AppItem
 */
export const systemAppToAppItem = (
  systemApp: SystemApp,
  translationKey: string
): AppItem => ({
  id: systemApp.id,
  name: translationKey,
  path: systemApp.path,
  mode: systemApp.id,
  icon: systemApp.icon,
  color: systemApp.color,
  isMiniApp: false,
});

/**
 * Convert a MiniApp to an AppItem
 */
export const miniAppToAppItem = (miniApp: MiniApp): AppItem => ({
  id: miniApp.id,
  name: miniApp.name,
  path: `/app/${miniApp.id}`, // doc-ai: view-only route, no AI builder
  mode: `mini-app-${miniApp.id}`,
  iconName: miniApp.icon,
  color: miniApp.color,
  isMiniApp: true,
});
