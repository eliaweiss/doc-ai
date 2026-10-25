"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import type { UIMessage, ChatStatus } from "ai";
import { isAiPartToolCall, getAiPartToolName } from "../../../../lib/utils";
import { toast } from "sonner";
import useOrgStore from "../../../../context-providers/orgStore";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { useFieldEditDialog } from "./FieldEditDialogProvider";
import type { FormulaCode, FieldDefinition, DocumentTypeRecord } from "@zdocs/types";

export type FormulaCodeChatContextValue = {
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  input: string;
  setInput: (input: string) => void;
};

const FormulaCodeChatContext = createContext<FormulaCodeChatContextValue | null>(
  null
);

export function useFormulaCodeChat() {
  const context = useContext(FormulaCodeChatContext);
  if (!context) {
    throw new Error(
      "useFormulaCodeChat must be used within a FormulaCodeChatProvider"
    );
  }
  return context;
}

function buildLineItemCollections(
  schema: DocumentTypeRecord | null
) {
  if (!schema?.lineItemSchemas) return {};
  const result: Record<string, { displayName: string; fields: FieldDefinition[] }> = {};
  for (const [key, collection] of Object.entries(schema.lineItemSchemas)) {
    result[key] = {
      displayName: collection.displayName,
      fields: collection.fields || [],
    };
  }
  return result;
}

/**
 * Extract the latest code from generateEdit tool outputs in messages.
 * Scans all messages so we always have the most recent code.
 */
function extractLatestCodeFromMessages(messages: UIMessage[]): string | null {
  let latestCode: string | null = null;
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (!isAiPartToolCall(part) || getAiPartToolName(part) !== "generateEdit") {
        continue;
      }
      const toolPart = part as unknown as {
        output?: { ok: boolean; code?: string };
      };
      if (toolPart.output?.ok && toolPart.output?.code) {
        latestCode = toolPart.output.code;
      }
    }
  }
  return latestCode;
}

export function FormulaCodeChatProvider({ children }: { children: ReactNode }) {
  const { org } = useOrgStore();
  const { selectedSchema } = useSchemaPage();
  const { formData, setFormData, editingField, saveField } = useFieldEditDialog();
  const orgId = org?.id ?? null;

  const [input, setInput] = useState("");

  const orgIdRef = React.useRef(orgId);
  orgIdRef.current = orgId;

  const formDataRef = React.useRef(formData);
  formDataRef.current = formData;

  const selectedSchemaRef = React.useRef(selectedSchema);
  selectedSchemaRef.current = selectedSchema;

  const editingFieldRef = React.useRef(editingField);
  editingFieldRef.current = editingField;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/formula-code",
        body: () => {
          const fd = formDataRef.current;
          const schema = selectedSchemaRef.current;
          const ef = editingFieldRef.current;
          const formula = fd?.formula as FormulaCode | undefined;

          // Prefer AI-generated code (from latestCodeRef) over formData code.
          // This handles the auto-send timing where formData hasn't been updated yet.
          const currentCode = latestCodeRef.current ?? formula?.code ?? null;

          return {
            orgId: orgIdRef.current,
            fieldName: fd?.name || "",
            fieldType: formula?.fieldType || fd?.type || "text",
            collectionKey: ef?.collectionKey || null,
            docTypeName: schema?.name || "",
            headerFields: schema?.headerSchema || [],
            lineItemCollections: buildLineItemCollections(schema),
            currentCode,
          };
        },
      }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    experimental_throttle: 50,
  });

  // Computed during render (before effects) so latestCodeRef is fresh
  // when sendAutomaticallyWhen triggers its auto-send in effects.
  const latestCodeFromTool = useMemo(
    () => extractLatestCodeFromMessages(messages),
    [messages]
  );
  const latestCodeRef = React.useRef<string | null>(null);
  latestCodeRef.current = latestCodeFromTool;

  // Sync AI-generated code back to formData and auto-save to backend
  useEffect(() => {
    if (!latestCodeFromTool) return;

    const fd = formDataRef.current;
    if (!fd) return;

    const currentFormula = (fd.formula || {
      fieldType: "text",
      inputFields: [],
      code: "",
    }) as FormulaCode;

    if (currentFormula.code === latestCodeFromTool) return;

    const updatedField = {
      ...fd,
      formula: { ...currentFormula, code: latestCodeFromTool } as FormulaCode,
    };

    setFormData(updatedField);
    saveField(updatedField);
  }, [latestCodeFromTool, setFormData, saveField]);

  useEffect(() => {
    if (status === "error" && error) {
      const errorMessage =
        typeof error === "string"
          ? error
          : error.message || "An error occurred while generating code";
      toast.error(errorMessage);
    }
  }, [status, error]);

  const value: FormulaCodeChatContextValue = {
    messages,
    status,
    sendMessage,
    input,
    setInput,
  };

  return (
    <FormulaCodeChatContext.Provider value={value}>
      {children}
    </FormulaCodeChatContext.Provider>
  );
}
