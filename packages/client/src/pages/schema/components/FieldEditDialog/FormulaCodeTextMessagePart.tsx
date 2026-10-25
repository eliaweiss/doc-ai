"use client";

import { CopyIcon } from "lucide-react";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  useMessagePart,
} from "@zdocs/client-component";

export function FormulaCodeTextMessagePart() {
  const { part, message, partIndex, dir } = useMessagePart();

  if (part.type !== "text" || !part.text) {
    return null;
  }

  return (
    <Message
      key={`${message.id}-${partIndex}`}
      from={message.role}
      dir={dir}
      data-testid={`formula-code-message-content-${message.role}`}
    >
      <MessageContent>
        <MessageResponse>{part.text}</MessageResponse>
      </MessageContent>
      {message.role === "assistant" && (
        <div className="pt-2 pb-4" data-testid="formula-code-message-actions">
          <MessageActions>
            <MessageAction
              onClick={() => navigator.clipboard.writeText(part.text)}
              label="Copy"
              data-testid="formula-code-copy-action"
            >
              <CopyIcon className="size-3" />
            </MessageAction>
          </MessageActions>
        </div>
      )}
    </Message>
  );
}
