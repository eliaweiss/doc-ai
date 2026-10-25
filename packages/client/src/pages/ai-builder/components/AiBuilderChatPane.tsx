import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@zdocs/client-component";
import { LoadingDots } from "@zdocs/client-component";
import { useAiBuilder } from "../context/AiBuilderProvider";
import { MessageList } from "./MessageList";
import { AiBuilderPromptInput } from "./AiBuilderPromptInput";

export function AiBuilderChatPane() {
  const { status } = useAiBuilder();

  return (
    <div
      className="flex flex-col h-full w-full p-4"
      data-testid="ai-builder-chat-pane"
    >
      <Conversation className="flex-1" data-testid="ai-builder-conversation">
        <ConversationContent className="max-w-[800px] mx-auto">
          <MessageList />
          {status !== "error" && status !== "ready" && (
            <LoadingDots className="py-4" data-testid="chat-loader" />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <AiBuilderPromptInput />
    </div>
  );
}
