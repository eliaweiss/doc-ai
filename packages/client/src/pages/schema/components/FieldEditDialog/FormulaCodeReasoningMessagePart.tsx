"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  useMessagePart,
} from "@zdocs/client-component";
import { useFormulaCodeChat } from "./FormulaCodeChatProvider";

export function FormulaCodeReasoningMessagePart() {
  const { status } = useFormulaCodeChat();
  const { part, message, partIndex, isLastPart, isLastMessage } =
    useMessagePart();

  if (part.type !== "reasoning" || !part.text) {
    return null;
  }

  return (
    <Reasoning
      key={`${message.id}-${partIndex}`}
      className="w-full"
      isStreaming={status === "streaming" && isLastPart && isLastMessage}
      data-testid="formula-code-reasoning-block"
    >
      <ReasoningTrigger />
      <ReasoningContent>{part.text}</ReasoningContent>
    </Reasoning>
  );
}
