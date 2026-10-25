import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@zdocs/client-component";
import { useAiBuilder } from "../context/AiBuilderProvider";
import { getDirectionFromText } from "@zdocs/util";
import { useEffect, useState } from "react";

export function AiBuilderPromptInput() {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");

  const { input, setInput, status, sendMessage, stop } = useAiBuilder();

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage({
      text: message.text || (hasAttachments ? "Sent with attachments" : ""),
      files: message.files,
    });
    setInput("");
  };

  useEffect(() => {
    setDir(getDirectionFromText(input));
  }, [input]);

  return (
    <PromptInput
      onSubmit={handleSubmit}
      className="mt-4 max-w-[800px] mx-auto"
      data-testid="ai-builder-prompt-input"
      dir={dir}
      multiple
    >
      <PromptInputHeader>
        <PromptInputAttachments>
          {(attachment) => (
            <PromptInputAttachment key={attachment.id} data={attachment} />
          )}
        </PromptInputAttachments>
      </PromptInputHeader>
      <PromptInputBody>
        <PromptInputTextarea
          onChange={(e) => setInput(e.target.value)}
          value={input}
          placeholder="Describe the Mini App you want to build..."
          data-testid="prompt-textarea"
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputActionMenu>
          <PromptInputActionMenuTrigger />
          <PromptInputActionMenuContent>
            <PromptInputActionAddAttachments />
          </PromptInputActionMenuContent>
        </PromptInputActionMenu>
        <PromptInputSubmit
          disabled={!input && status !== "streaming" && status !== "submitted"}
          status={status}
          onStop={stop}
          data-testid="submit-button"
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
