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
import { useMiniApp } from "./MiniAppProvider";
import { isAiPartToolCall, getAiPartToolName } from "../../../lib/utils";
import { toast } from "sonner";

export type AiBuilderContextValue = {
  // Mini App identity
  miniAppId: string | null;
  orgId: string | null;

  // Chat state
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  regenerate: ReturnType<typeof useChat>["regenerate"];
  stop: ReturnType<typeof useChat>["stop"];

  // Input state (persisted to survive layout changes)
  input: string;
  setInput: (input: string) => void;

  // Mini App code state
  miniAppCode: string | null;
  setMiniAppCode: (code: string | null) => void;

  // Fullscreen state
  isFullscreen: boolean;
  setIsFullscreen: (isFullscreen: boolean) => void;
};

const AiBuilderContext = createContext<AiBuilderContextValue | null>(null);

export function useAiBuilder() {
  const context = useContext(AiBuilderContext);
  if (!context) {
    throw new Error("useAiBuilder must be used within a AiBuilderProvider");
  }
  return context;
}

export type AiBuilderProviderProps = {
  children: ReactNode;
  apiEndpoint?: string;
  initialFullscreen: boolean;
};

export function AiBuilderProvider({
  children,
  apiEndpoint = "/api/chat/ai-builder",
  initialFullscreen,
}: AiBuilderProviderProps) {
  const { miniApp, orgId } = useMiniApp();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync with initialFullscreen prop changes
  useEffect(() => {
    setIsFullscreen(initialFullscreen);
  }, [initialFullscreen]);

  const [input, setInput] = useState("");
  const [miniAppCode, setMiniAppCode] = useState<string | null>(
    miniApp?.code ?? null
  );

  // Update code when Mini App changes
  useEffect(() => {
    setMiniAppCode(miniApp?.code ?? null);
    // Reset the flag so the next batch of messages from the new mini app is treated as initial load
    hasInitializedMessagesRef.current = false;
  }, [miniApp?.code]);

  // Use refs to access latest values in the transport
  const miniAppIdRef = React.useRef(miniApp?.id ?? null);
  miniAppIdRef.current = miniApp?.id ?? null;

  const orgIdRef = React.useRef(orgId);
  orgIdRef.current = orgId;

  // Track pending code updates from generateEdit tool calls
  // This allows us to debounce saves until streaming completes
  const pendingCodeRef = React.useRef<string | null>(null);
  const pendingAppliedCountRef = React.useRef<number>(0);

  // Skip extracting code from tool results on initial message load.
  // Only process generateEdit results from NEW messages during active streaming.
  const hasInitializedMessagesRef = React.useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: () => {
          const bodyPayload = {
            miniAppId: miniAppIdRef.current,
            orgId: orgIdRef.current,
          };
          // console.log("[AiBuilderProvider] Sending body payload:", bodyPayload);
          return bodyPayload;
        },
      }),
    [apiEndpoint]
  );

  const prevStatusRef = React.useRef<ChatStatus | null>(null);

  // console.log("miniApp messages", miniApp?.messages);
  // console.log("miniApp ", miniApp);

  const handleToolCall = (toolCall: any) => {
    console.log("toolCall", toolCall);
  };

  const { messages, sendMessage, status, regenerate, stop, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    experimental_throttle: 50, // Throttle UI updates to prevent rapid re-renders
    messages: miniApp?.messages ?? [], // Initialize with messages from database
    onToolCall: handleToolCall,
  });



  // Detect generateEdit tool results in messages and update code
  // The server applies edits and returns the new code in the tool result
  useEffect(() => {
    // Skip the initial load of messages from DB - those contain stale tool results
    // that would overwrite the freshly loaded miniApp.code
    if (!hasInitializedMessagesRef.current) {
      hasInitializedMessagesRef.current = true;
      return;
    }

    const lastMessage = messages.at(-1);

    if (lastMessage?.role === "assistant") {
      for (const part of lastMessage.parts) {
        const isToolCall = isAiPartToolCall(part);
        const toolName = getAiPartToolName(part);
        // console.log("[AiBuilderProvider] Checking part:", {
        //   type: part.type,
        //   isToolCall,
        //   toolName,
        // });

        // Use utility functions to check for tool calls
        if (isToolCall && toolName === "generateEdit") {
          // The tool output contains the new code from server-side edit application
          // AI SDK uses "output" for tool results, not "result"
          const toolPart = part as unknown as {
            output?: {
              ok: boolean;
              code?: string;
              applied?: number;
              failures?: Array<{ error: string; anchor: string; type: string }>;
            };
          };

          // console.log("[AiBuilderProvider] generateEdit tool found:", {
          //   hasOutput: !!toolPart.output,
          //   ok: toolPart.output?.ok,
          //   hasCode: !!toolPart.output?.code,
          //   applied: toolPart.output?.applied,
          //   miniAppId: miniApp?.id,
          //   orgId,
          // });

          if (
            toolPart.output?.ok &&
            toolPart.output?.code &&
            miniApp?.id &&
            orgId
          ) {
            // Store values for debounced save
            const newCode = toolPart.output.code;
            const appliedCount = toolPart.output.applied ?? 0;

            if (
              toolPart.output.failures &&
              toolPart.output.failures.length > 0
            ) {
              console.warn(
                "Some edits failed to apply:",
                toolPart.output.failures
              );
            }

            // Update preview immediately (optimistic update)
            setMiniAppCode(newCode);

            // Store pending code for debounced save when streaming completes
            pendingCodeRef.current = newCode;
            pendingAppliedCountRef.current = appliedCount;

            console.log(
              `[AiBuilderProvider] Received ${appliedCount} applied edit(s) from server (will save when streaming completes)`
            );
          }
        }
      }
    }
  }, [messages, miniApp?.id, orgId]);

  // Save pending code to database when streaming completes
  useEffect(() => {
    console.log("status", status, messages);

    if (status === "ready" && miniApp?.id && orgId) {
      // console.log("status is ready, messages:", messages);

      // Clear pending refs before async operation
      pendingCodeRef.current = null;
      pendingAppliedCountRef.current = 0;
      if (status === "ready" && prevStatusRef.current !== "streaming") {
        // const codeToSave = pendingCodeRef.current;
        // const appliedCount = pendingAppliedCountRef.current;
        // // Save to database and verify success
        // disable saving for now - done in the server-side
        // updateMiniAppApi(orgId, miniApp.id, {
        //   code: codeToSave,
        // })
        //   .then(() => {
        //     console.log(
        //       `[AiBuilderProvider] Successfully saved ${appliedCount} edit(s) to database after streaming completed`
        //     );
        //   })
        //   .catch((err) => {
        //     console.error("Failed to save Mini App code:", err);
        //     toast.error("Failed to save Mini App code. Please try again.");
        //     // Restore pending code so it can be retried
        //     pendingCodeRef.current = codeToSave;
        //     pendingAppliedCountRef.current = appliedCount;
        //   });
      }
    }

    if (status === "error") {
      console.log("error", error);
      // Clear pending code on error
      pendingCodeRef.current = null;
      pendingAppliedCountRef.current = 0;

      // Show error toast to user
      if (error) {
        // Extract error message - handle both string and Error types
        const errorMessage = typeof error === "string"
          ? error
          : error.message || "An error occurred while generating code";
        toast.error(errorMessage);
      }
    }
    prevStatusRef.current = status;

  }, [status, miniApp?.id, orgId, error]);

  const value: AiBuilderContextValue = {
    miniAppId: miniApp?.id ?? null,
    orgId: orgId ?? null,
    messages,
    status,
    sendMessage,
    regenerate,
    stop,
    input,
    setInput,
    miniAppCode,
    setMiniAppCode,
    isFullscreen,
    setIsFullscreen,
  };

  return (
    <AiBuilderContext.Provider value={value}>
      {children}
    </AiBuilderContext.Provider>
  );
}
