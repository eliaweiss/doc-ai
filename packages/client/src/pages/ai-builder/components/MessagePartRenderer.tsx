import { isAiPartToolCall } from "../../../lib/utils";
import { useMessagePart } from "@zdocs/client-component";
import { TextMessagePart } from "./TextMessagePart";
import { ReasoningMessagePart } from "./ReasoningMessagePart";
import { ToolCallMessagePart } from "./ToolCallMessagePart";
import { SourcesMessagePart } from "./SourcesMessagePart";
import { ImageFilePart } from "./ImageFilePart";

export function MessagePartRenderer() {
  const { part } = useMessagePart();

  // Check for tool calls first (they have types like "tool-displayHtml")
  if (isAiPartToolCall(part)) {
    return <ToolCallMessagePart />;
  }

  switch (part.type) {
    case "text":
      return <TextMessagePart />;
    case "reasoning":
      return <ReasoningMessagePart />;
    case "source-url":
      return <SourcesMessagePart />;
    case "file":
      return <ImageFilePart />;
    default:
      return null;
  }
}
