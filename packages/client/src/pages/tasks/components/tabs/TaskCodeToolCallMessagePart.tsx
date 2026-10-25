import { isAiPartToolCall, getAiPartToolName } from "../../../../lib/utils";
import { useMessagePart } from "@zdocs/client-component";
import { GenerateEditsWidget } from "../../../ai-builder/components/GenerateEditsWidget";

export function TaskCodeToolCallMessagePart() {
  const { part } = useMessagePart();

  if (!isAiPartToolCall(part)) {
    return null;
  }

  const toolName = getAiPartToolName(part);

  if (toolName === "generateEdit") {
    return <GenerateEditsWidget />;
  }

  // Tool calls are handled by ShowPendingToolCalls component
  // This component doesn't need to render anything specific
  return null;
}
