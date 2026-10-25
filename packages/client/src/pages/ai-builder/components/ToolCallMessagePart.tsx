import { isAiPartToolCall, getAiPartToolName } from "../../../lib/utils";
import { useMessagePart } from "@zdocs/client-component";
import { GenerateEditsWidget } from "./GenerateEditsWidget";

export function ToolCallMessagePart() {
  const { part } = useMessagePart();

  if (!isAiPartToolCall(part)) {
    return null;
  }

  const toolName = getAiPartToolName(part);

  if (toolName === "generateEdit") {
    return <GenerateEditsWidget />;
  }

  return null;
}
