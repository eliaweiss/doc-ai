"use client";

import { useFormulaCodeChat } from "./FormulaCodeChatProvider";
import { MessagePartProvider } from "@zdocs/client-component";
import { FormulaCodeMessagePartRenderer } from "./FormulaCodeMessagePartRenderer";
import { FormulaCodeShowPendingToolCalls } from "./FormulaCodeShowPendingToolCalls";

export function FormulaCodeMessageList() {
  const { messages } = useFormulaCodeChat();

  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          data-testid={`formula-code-message-${message.id}`}
        >
          {message.parts.map((part, i) => (
            <MessagePartProvider
              key={`${message.id}-${i}`}
              part={part}
              message={message}
              messages={messages}
              partIndex={i}
            >
              <FormulaCodeShowPendingToolCalls />
              <FormulaCodeMessagePartRenderer />
            </MessagePartProvider>
          ))}
        </div>
      ))}
    </>
  );
}
