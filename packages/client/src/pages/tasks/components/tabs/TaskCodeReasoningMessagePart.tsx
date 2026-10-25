import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  useMessagePart,
} from "@zdocs/client-component";
import { useTaskCodeChat } from "../../context/TaskCodeChatProvider";

export function TaskCodeReasoningMessagePart() {
  const { status } = useTaskCodeChat();
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
      data-testid="task-code-reasoning-block"
    >
      <ReasoningTrigger />
      <ReasoningContent>{part.text}</ReasoningContent>
    </Reasoning>
  );
}
