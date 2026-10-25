"use client";

import { isAiPartToolCall, getAiPartToolName } from "../../../../lib/utils";
import { useMessagePart } from "@zdocs/client-component";
import { GenerateEditsWidget } from "../../../ai-builder/components/GenerateEditsWidget";

export function FormulaCodeToolCallMessagePart() {
  const { part } = useMessagePart();

  if (!isAiPartToolCall(part)) {
    return null;
  }

  if (getAiPartToolName(part) === "generateEdit") {
    return <GenerateEditsWidget />;
  }

  return null;
}
