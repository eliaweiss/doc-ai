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
import { useTaskCodeChat } from "../../context/TaskCodeChatProvider";
import { getDirectionFromText } from "@zdocs/util";
import { useEffect, useState } from "react";

export function TaskCodePromptInput() {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");

  const { input, setInput, status, sendMessage, taskId, orgId } =
    useTaskCodeChat();

  //   console.log("[TaskCodePromptInput] taskId, orgId", taskId, orgId);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    // Guard: Don't send if taskId or orgId are missing
    if (!taskId || !orgId) {
      console.error(
        "[TaskCodePromptInput] Cannot send message: missing taskId or orgId",
        {
          taskId,
          orgId,
        }
      );
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
      data-testid="task-code-prompt-input"
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
          placeholder="Describe the code changes you want to make..."
          data-testid="task-code-prompt-textarea"
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
          disabled={(!input && status !== "streaming") || !taskId || !orgId}
          status={status}
          data-testid="task-code-submit-button"
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
