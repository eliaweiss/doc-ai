import type { UIMessage } from "ai";

/**
 * AI Builder Interaction - represents a single interaction/log entry
 * for AI builder mini app interactions
 */
export type AiBuilderInteraction = {
  id: string;
  orgId: string;
  miniAppId: string;
  effectiveMessages: UIMessage[];
  systemPrompt: string;
  tools: Record<string, any>;
  resultMessages: UIMessage[];
  createdAt: Date;
};
