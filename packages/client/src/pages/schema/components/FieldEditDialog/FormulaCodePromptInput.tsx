"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@zdocs/client-component";
import { useFormulaCodeChat } from "./FormulaCodeChatProvider";
import { getDirectionFromText } from "@zdocs/util";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import useOrgStore from "../../../../context-providers/orgStore";

export function FormulaCodePromptInput() {
  const t = useTranslations("schema");
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  const { org } = useOrgStore();
  const orgId = org?.id ?? null;

  const { input, setInput, status, sendMessage } = useFormulaCodeChat();

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text) return;
    if (!orgId) return;

    sendMessage({ text: message.text });
    setInput("");
  };

  useEffect(() => {
    setDir(getDirectionFromText(input));
  }, [input]);

  return (
    <PromptInput
      onSubmit={handleSubmit}
      className="mt-3"
      data-testid="formula-code-prompt-input bg-white dark:bg-black "
      dir={dir}
    >
      <PromptInputBody>
        <PromptInputTextarea
          onChange={(e) => setInput(e.target.value)}
          value={input}
          placeholder={t("formulaCodePromptPlaceholder")}
          data-testid="formula-code-prompt-textarea"
        />
      </PromptInputBody>
      <PromptInputFooter>
        <div className="w-full flex justify-end bg-white dark:bg-black">

          <PromptInputSubmit
            disabled={!input || !orgId}
            status={status}
            data-testid="formula-code-submit-button"
          />
        </div>
      </PromptInputFooter>
    </PromptInput>
  );
}
