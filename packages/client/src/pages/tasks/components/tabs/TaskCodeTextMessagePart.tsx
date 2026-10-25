import { CopyIcon, RefreshCcwIcon } from "lucide-react";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  useMessagePart,
} from "@zdocs/client-component";
import { useTaskCodeChat } from "../../context/TaskCodeChatProvider";

export function TaskCodeTextMessagePart() {
  const { regenerate } = useTaskCodeChat();
  const { part, message, partIndex, dir } = useMessagePart();

  if (part.type !== "text" || !part.text) {
    return null;
  }

  return (
    <Message
      key={`${message.id}-${partIndex}`}
      from={message.role}
      dir={dir}
      data-testid={`task-code-message-content-${message.role}`}
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
              data-testid="task-code-retry-action"
            >
              <RefreshCcwIcon className="size-3" />
            </MessageAction>
            <MessageAction
              onClick={() => navigator.clipboard.writeText(part.text)}
              label="Copy"
              data-testid="task-code-copy-action"
            >
              <CopyIcon className="size-3" />
            </MessageAction>
          </MessageActions>
        </div>
      )}
    </Message>
  );
}
