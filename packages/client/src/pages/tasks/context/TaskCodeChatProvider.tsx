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
import { useTasksPage } from "./TasksPageProvider";
import { isAiPartToolCall, getAiPartToolName } from "../../../lib/utils";
import { updateTask } from "../../../utilities/api/fetchTasks";
import { toast } from "sonner";
import useOrgStore from "packages/client/src/context-providers/orgStore";

export type TaskCodeChatContextValue = {
  // Task identity
  taskId: string | null;
  orgId: string | null;

  // Chat state
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: ReturnType<typeof useChat>["sendMessage"];
  regenerate: ReturnType<typeof useChat>["regenerate"];

  // Input state (persisted to survive layout changes)
  input: string;
  setInput: (input: string) => void;

  // Task code state
  taskCode: string | null;
  setTaskCode: (code: string | null) => void;
};

const TaskCodeChatContext = createContext<TaskCodeChatContextValue | null>(
  null
);

export function useTaskCodeChat() {
  const context = useContext(TaskCodeChatContext);
  if (!context) {
    throw new Error(
      "useTaskCodeChat must be used within a TaskCodeChatProvider"
    );
  }
  return context;
}

export type TaskCodeChatProviderProps = {
  children: ReactNode;
  apiEndpoint?: string;
};

export function TaskCodeChatProvider({
  children,
  apiEndpoint = "/api/chat/task-code",
}: TaskCodeChatProviderProps) {
  const { org } = useOrgStore();
  const { selectedTask, refreshTask } = useTasksPage();
  const orgId = org?.id ?? null;

  const [input, setInput] = useState("");
  const [taskCode, setTaskCode] = useState<string | null>(
    selectedTask?.functionCode ?? null
  );

  // Update code when task changes
  useEffect(() => {
    setTaskCode(selectedTask?.functionCode ?? null);
  }, [selectedTask?.functionCode]);

  // Use refs to access latest values in the transport
  const taskIdRef = React.useRef(selectedTask?.id ?? null);
  taskIdRef.current = selectedTask?.id ?? null;

  const orgIdRef = React.useRef(orgId);
  orgIdRef.current = orgId;

  // Track pending code updates from generateEdit tool calls
  // This allows us to debounce saves until streaming completes
  const pendingCodeRef = React.useRef<string | null>(null);
  const pendingAppliedCountRef = React.useRef<number>(0);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: () => {
          const taskId = taskIdRef.current;
          const orgId = orgIdRef.current;

          if (!taskId || !orgId) {
            console.error(
              "[TaskCodeChatProvider] Cannot send request: missing taskId or orgId",
              {
                taskId,
                orgId,
                selectedTaskId: selectedTask?.id,
                orgIdFromStore: org?.id,
              }
            );
            // Still return the payload - let the API handle the validation
            // This allows us to see the error in the API logs
          }

          const bodyPayload = {
            taskId,
            orgId,
          };
          console.log(
            "[TaskCodeChatProvider] Sending body payload:",
            bodyPayload
          );
          return bodyPayload;
        },
      }),
    [apiEndpoint]
  );

  const { messages, sendMessage, status, regenerate, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    experimental_throttle: 50, // Throttle UI updates to prevent rapid re-renders
    messages: selectedTask?.messages ?? [], // Initialize with messages from database
  });

  // Detect generateEdit tool results in messages and update code
  // The server applies edits and returns the new code in the tool result
  useEffect(() => {
    const lastMessage = messages.at(-1);

    if (lastMessage?.role === "assistant") {
      for (const part of lastMessage.parts) {
        const isToolCall = isAiPartToolCall(part);
        const toolName = getAiPartToolName(part);

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

          if (
            toolPart.output?.ok &&
            toolPart.output?.code &&
            selectedTask?.id &&
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

            // Update code immediately (optimistic update)
            setTaskCode(newCode);

            // Store pending code for debounced save when streaming completes
            pendingCodeRef.current = newCode;
            pendingAppliedCountRef.current = appliedCount;

            console.log(
              `[TaskCodeChatProvider] Received ${appliedCount} applied edit(s) from server (will save when streaming completes)`
            );
          }
        }
      }
    }
  }, [messages, selectedTask?.id, orgId]);

  // Save pending code and messages to database when streaming completes
  useEffect(() => {
    if (
      status === "ready" &&
      pendingCodeRef.current &&
      selectedTask?.id &&
      orgId
    ) {
      const codeToSave = pendingCodeRef.current;
      const appliedCount = pendingAppliedCountRef.current;

      // Clear pending refs before async operation
      pendingCodeRef.current = null;
      pendingAppliedCountRef.current = 0;

      // Save to database and verify success
      updateTask(orgId, selectedTask.id, {
        functionCode: codeToSave,
        messages: messages,
      })
        .then(() => {
          console.log(
            `[TaskCodeChatProvider] Successfully saved ${appliedCount} edit(s) to database after streaming completed`
          );
          // Refresh task to get updated data
          if (refreshTask && selectedTask.id) {
            refreshTask(selectedTask.id).catch((err) => {
              console.error("Failed to refresh task after save:", err);
            });
          }
        })
        .catch((err) => {
          console.error("Failed to save task code:", err);
          toast.error("Failed to save task code. Please try again.");
          // Restore pending code so it can be retried
          pendingCodeRef.current = codeToSave;
          pendingAppliedCountRef.current = appliedCount;
        });
    }

    if (status === "error") {
      // Clear pending code on error
      pendingCodeRef.current = null;
      pendingAppliedCountRef.current = 0;

      // Show error toast to user
      if (error) {
        const errorMessage = typeof error === "string"
          ? error
          : error.message || "An error occurred while generating code";
        toast.error(errorMessage);
      }
    }
  }, [status, selectedTask?.id, orgId, error, messages]);

  const value: TaskCodeChatContextValue = {
    taskId: selectedTask?.id ?? null,
    orgId: orgId ?? null,
    messages,
    status,
    sendMessage,
    regenerate,
    input,
    setInput,
    taskCode,
    setTaskCode,
  };

  return (
    <TaskCodeChatContext.Provider value={value}>
      {children}
    </TaskCodeChatContext.Provider>
  );
}
