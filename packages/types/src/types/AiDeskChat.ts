// ═══════════════════════════════════════════════════════════════════════════════
// AI DESK CHAT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

import type { UIMessage } from "ai";

/**
 * An AI Desk chat session stored in the database
 */
export interface AiDeskChatFlags {
  canvasEnabled?: boolean;
  tablesEnabled?: boolean;
  docSearchEnabled?: boolean;
  codeExecutionEnabled?: boolean;
  webSearchEnabled?: boolean;
}

export interface AiDeskChat {
  id: string;
  orgId: string;
  userId: string | null;
  title: string | null;
  messages: UIMessage[];
  canvasHtml: string | null;
  canvasTitle: string | null;
  flags: AiDeskChatFlags;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parameters for creating a new AI Desk chat
 */
export interface CreateAiDeskChatParams {
  orgId: string;
  userId?: string | null;
  title?: string | null;
}

/**
 * Parameters for updating an AI Desk chat
 */
export interface UpdateAiDeskChatParams {
  title?: string | null;
  messages?: UIMessage[];
  canvasHtml?: string | null;
  canvasTitle?: string | null;
  flags?: AiDeskChatFlags;
}
