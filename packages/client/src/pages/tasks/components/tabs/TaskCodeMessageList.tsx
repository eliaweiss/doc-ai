import { useTaskCodeChat } from "../../context/TaskCodeChatProvider";
import { MessagePartProvider } from "@zdocs/client-component";
import { TaskCodeMessagePartRenderer } from "./TaskCodeMessagePartRenderer";
import { TaskCodeShowPendingToolCalls } from "./TaskCodeShowPendingToolCalls";

export function TaskCodeMessageList() {
  const { messages } = useTaskCodeChat();

  return (
    <>
      {messages.map((message) => (
        <div key={message.id} data-testid={`task-code-message-${message.id}`}>
          {message.parts.map((part, i) => (
            <MessagePartProvider
              key={`${message.id}-${i}`}
              part={part}
              message={message}
              messages={messages}
              partIndex={i}
            >
              <TaskCodeShowPendingToolCalls />
              <TaskCodeMessagePartRenderer />
            </MessagePartProvider>
          ))}
        </div>
      ))}
    </>
  );
}
