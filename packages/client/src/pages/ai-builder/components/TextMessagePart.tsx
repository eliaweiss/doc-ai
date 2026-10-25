import { CopyIcon, RefreshCcwIcon } from "lucide-react";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  useMessagePart,
} from "@zdocs/client-component";
import { useAiBuilder } from "../context/AiBuilderProvider";

export function TextMessagePart() {
  const { regenerate } = useAiBuilder();
  const { part, message, partIndex, dir } = useMessagePart();

  if (part.type !== "text" || !part.text) {
    return null;
  }

  return (
    <Message
      key={`${message.id}-${partIndex}`}
      from={message.role}
      dir={dir}
      data-testid={`message-content-${message.role}`}
    >
      <MessageContent>
        <MessageResponse>{part.text}</MessageResponse>
      </MessageContent>
      {message.role === "assistant" && (
        <div className="pt-2 pb-10">
          <MessageActions>
            <MessageAction
              onClick={() => regenerate()}
              label="Retry"
              data-testid="retry-action"
            >
              <RefreshCcwIcon className="size-3" />
            </MessageAction>
            <MessageAction
              onClick={() => navigator.clipboard.writeText(part.text)}
              label="Copy"
              data-testid="copy-action"
            >
              <CopyIcon className="size-3" />
            </MessageAction>
          </MessageActions>
        </div>
      )}
    </Message>
  );
}
