import { isAiPartToolCall } from "../../../../lib/utils";
import { useMessagePart } from "@zdocs/client-component";
import { TaskCodeTextMessagePart } from "./TaskCodeTextMessagePart";
import { TaskCodeReasoningMessagePart } from "./TaskCodeReasoningMessagePart";
import { TaskCodeToolCallMessagePart } from "./TaskCodeToolCallMessagePart";
import { TaskCodeSourcesMessagePart } from "./TaskCodeSourcesMessagePart";
import { TaskCodeImageFilePart } from "./TaskCodeImageFilePart";

export function TaskCodeMessagePartRenderer() {
  const { part } = useMessagePart();

  // Check for tool calls first (they have types like "tool-displayHtml")
  if (isAiPartToolCall(part)) {
    return <TaskCodeToolCallMessagePart />;
  }

  switch (part.type) {
    case "text":
      return <TaskCodeTextMessagePart />;
    case "reasoning":
      return <TaskCodeReasoningMessagePart />;
    case "source-url":
      return <TaskCodeSourcesMessagePart />;
    case "file":
      return <TaskCodeImageFilePart />;
    default:
      return null;
  }
}
