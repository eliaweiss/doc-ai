import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  useMessagePart,
} from "@zdocs/client-component";
import { useAiBuilder } from "../context/AiBuilderProvider";

export function ReasoningMessagePart() {
  const { status } = useAiBuilder();
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
      data-testid="reasoning-block"
    >
      <ReasoningTrigger />
      <ReasoningContent>{part.text}</ReasoningContent>
    </Reasoning>
  );
}
