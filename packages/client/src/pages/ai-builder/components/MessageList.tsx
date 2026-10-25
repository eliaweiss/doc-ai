import { useAiBuilder } from "../context/AiBuilderProvider";
import { MessagePartProvider } from "@zdocs/client-component";
import { MessagePartRenderer } from "./MessagePartRenderer";
import { ShowPendingToolCalls } from "./ShowPendingToolCalls";

export function MessageList() {
  const { messages } = useAiBuilder();

  return (
    <>
      {messages.map((message) => (
        <div key={message.id} data-testid={`message-${message.id}`}>
          {message.parts.map((part, i) => (
            <MessagePartProvider
              key={`${message.id}-${i}`}
              part={part}
              message={message}
              messages={messages}
              partIndex={i}
            >
              <ShowPendingToolCalls />
              <MessagePartRenderer />
            </MessagePartProvider>
          ))}
        </div>
      ))}
    </>
  );
}
