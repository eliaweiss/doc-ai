import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@zdocs/client-component";
import { LoadingDots } from "@zdocs/client-component";
import { useTaskCodeChat } from "../../context/TaskCodeChatProvider";
import { TaskCodeMessageList } from "./TaskCodeMessageList";
import { TaskCodePromptInput } from "./TaskCodePromptInput";

export function TaskCodeChatPane() {
  const { status } = useTaskCodeChat();

  return (
    <div
      className="flex flex-col h-full w-full p-4"
      data-testid="task-code-chat-pane"
    >
      <Conversation className="flex-1" data-testid="task-code-conversation">
        <ConversationContent className="max-w-[800px] mx-auto">
          <TaskCodeMessageList />
          {status !== "ready" && (
            <LoadingDots className="py-4" data-testid="task-code-chat-loader" />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <TaskCodePromptInput />
    </div>
  );
}
