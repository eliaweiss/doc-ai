/**
 * Mini App Types
 *
 * Types for user-created mini applications built with the AI App Builder.
 */

import type { UIMessage } from "ai";

/**
 * Mini App stored in database
 */
export interface MiniApp {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null; // Hex color code (e.g., #6366f1)
  icon: string | null; // Lucide icon name (e.g., "Settings", "Home")
  code: string; // HTML+JS+CSS code
  isPublished: boolean;
  archivedAt: Date | null; // Set when archived; archived apps are hidden from app lists
  messages: UIMessage[]; // Chat messages history
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mini App creation params
 */
export interface CreateMiniAppParams {
  orgId: string;
  userId: string;
  name: string;
  description?: string;
  color?: string | null;
  icon?: string | null;
  code: string;
  isPublished?: boolean;
}

/**
 * Mini App update params
 */
export interface UpdateMiniAppParams {
  messages?: UIMessage[];
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  code?: string;
  isPublished?: boolean;
  archived?: boolean; // true archives the app, false restores it
}

/**
 * Mini App History - snapshot of mini app at save time
 */
export interface MiniAppHistory {
  id: string;
  miniAppId: string;
  orgId: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  code: string;
  isPublished: boolean;
  createdAt: Date;
}
