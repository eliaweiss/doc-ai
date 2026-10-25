import useOrgStore from "../../context-providers/orgStore";
import { zFetch } from "../../lib/utils";
import type { AiDeskChat, UserOrgSettings } from "@zdocs/types";

export interface CreateAiDeskChatResponse {
  chat: AiDeskChat;
}

export interface GetAiDeskChatResponse {
  chat: AiDeskChat;
}

export interface ListAiDeskChatsResponse {
  chats: AiDeskChat[];
}

export interface UserOrgSettingsResponse {
  settings: UserOrgSettings;
}

/**
 * Create a new AI Desk chat
 */
export async function createAiDeskChat(
  orgId: string,
  title?: string
): Promise<AiDeskChat> {
  const response = await zFetch(`/api/org/${orgId}/ai-desk/create`, {
    method: "POST",
    body: { title },
  });
  return response.chat;
}

/**
 * Load an existing AI Desk chat
 */
export async function loadAiDeskChat(
  orgId: string,
  chatId: string
): Promise<AiDeskChat> {
  const response = await zFetch(`/api/org/${orgId}/ai-desk/${chatId}`, {
    method: "POST",
  });
  return response.chat;
}

/**
 * List AI Desk chats for an organization
 */
export async function listAiDeskChats(orgId: string): Promise<AiDeskChat[]> {
  const response = await zFetch(`/api/org/${orgId}/ai-desk/list`, {
    method: "POST",
  });
  return response.chats;
}

/**
 * Generate a title for an AI Desk chat
 */
export async function generateAiDeskChatTitle(
  chatId: string
): Promise<AiDeskChat> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization ID found");
  }
  const response = await zFetch(`/api/org/${orgId}/ai-desk/${chatId}/title`, {
    method: "POST",
  });
  return response.chat;
}

/**
 * Delete an AI Desk chat
 */
export async function deleteAiDeskChat(
  orgId: string,
  chatId: string
): Promise<boolean> {
  // Use the update endpoint with DELETE method if available, or create a delete endpoint
  // For now, let's assume we need a delete endpoint
  const response = await zFetch(`/api/org/${orgId}/ai-desk/${chatId}`, {
    method: "DELETE",
  });
  return response.success;
}

/**
 * Get user org settings
 */
export async function getUserOrgSettings(
  orgId: string
): Promise<UserOrgSettings> {
  const response = await zFetch(`/api/org/${orgId}/user-settings`, {
    method: "POST",
  });
  return response.settings;
}

/**
 * Toggle pin status for a chat
 */
export async function toggleChatPin(
  orgId: string,
  chatId: string
): Promise<UserOrgSettings> {
  const response = await zFetch(`/api/org/${orgId}/ai-desk/${chatId}/pin`, {
    method: "POST",
  });
  return response.settings;
}

/**
 * Update AI Desk chat flags
 */
export async function updateAiDeskChatFlags(
  orgId: string,
  chatId: string,
  flags: {
    canvasEnabled?: boolean;
    tablesEnabled?: boolean;
    docSearchEnabled?: boolean;
    codeExecutionEnabled?: boolean;
    webSearchEnabled?: boolean;
  }
): Promise<AiDeskChat> {
  const response = await zFetch(`/api/org/${orgId}/ai-desk/${chatId}`, {
    method: "PUT",
    body: { flags },
  });
  return response.chat;
}
