"use client";

import { isAiPartToolCall } from "../../../../lib/utils";
import { useMessagePart } from "@zdocs/client-component";
import { FormulaCodeTextMessagePart } from "./FormulaCodeTextMessagePart";
import { FormulaCodeReasoningMessagePart } from "./FormulaCodeReasoningMessagePart";
import { FormulaCodeToolCallMessagePart } from "./FormulaCodeToolCallMessagePart";

export function FormulaCodeMessagePartRenderer() {
  const { part } = useMessagePart();

  if (isAiPartToolCall(part)) {
    return <FormulaCodeToolCallMessagePart />;
  }

  switch (part.type) {
    case "text":
      return <FormulaCodeTextMessagePart />;
    case "reasoning":
      return <FormulaCodeReasoningMessagePart />;
    default:
      return null;
  }
}
