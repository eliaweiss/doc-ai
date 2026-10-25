"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  LoadingDots,
} from "@zdocs/client-component";
import { useFormulaCodeChat } from "./FormulaCodeChatProvider";
import { FormulaCodeMessageList } from "./FormulaCodeMessageList";
import { FormulaCodePromptInput } from "./FormulaCodePromptInput";

export function FormulaCodeChatPane() {
  const { status } = useFormulaCodeChat();

  return (
    <div
      className="flex flex-col h-full w-full"
      data-testid="formula-code-chat-pane"
    >
      <Conversation className="flex-1" data-testid="formula-code-conversation">
        <ConversationContent className="max-w-full mx-auto">
          <FormulaCodeMessageList />
          {status !== "ready" && (
            <LoadingDots
              className="py-4"
              data-testid="formula-code-chat-loader"
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <FormulaCodePromptInput />
    </div>
  );
}
