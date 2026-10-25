"use client";

import { create } from "zustand";

interface WebsiteChatState {
  open: boolean;
  setOpen: (open: boolean) => void;

  startWithMessage: string;
  setStartWithMessage: (message: string) => void;
}

export const useWebsiteChatStore = create<WebsiteChatState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  startWithMessage: "",
  setStartWithMessage: (message) => set({ startWithMessage: message }),
}));

export function WebsiteChatProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
