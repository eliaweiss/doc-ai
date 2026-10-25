"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
  useState,
  useEffect,
} from "react";
import type { UIMessagePart, UIMessage } from "ai";
import { getDirectionFromText } from "@zdocs/util";

export type MessagePartContextValue = {
  part: UIMessagePart<any, any>;
  message: UIMessage;
  partIndex: number;
  isLastPart: boolean;
  isLastMessage: boolean;
  dir: "ltr" | "rtl";
};

const MessagePartContext = createContext<MessagePartContextValue | null>(null);

export function useMessagePart() {
  const context = useContext(MessagePartContext);
  if (!context) {
    throw new Error("useMessagePart must be used within a MessagePartProvider");
  }
  return context;
}

type MessagePartProviderProps = {
  children: ReactNode;
  part: UIMessagePart<any, any>;
  message: UIMessage;
  messages: UIMessage[];
  partIndex: number;
};

/**
 * Shared MessagePartProvider that can be used by both AI Desk and AI Builder.
 * Receives messages as a prop to avoid coupling to any specific parent provider.
 */
export function MessagePartProvider({
  children,
  part,
  message,
  messages,
  partIndex,
}: MessagePartProviderProps) {
  const [dir, setDir] = useState<"ltr" | "rtl">(() =>
    getDirectionFromText(message)
  );

  useEffect(() => {
    const newDir = getDirectionFromText(message);
    if (newDir !== dir) {
      setDir(newDir);
    }
  }, [message, dir]);

  const value = useMemo<MessagePartContextValue>(
    () => ({
      part,
      message,
      partIndex,
      isLastPart: partIndex === message.parts.length - 1,
      isLastMessage: message.id === messages.at(-1)?.id,
      dir,
    }),
    [part, message, partIndex, messages, dir]
  );

  return (
    <MessagePartContext.Provider value={value}>
      {children}
    </MessagePartContext.Provider>
  );
}
