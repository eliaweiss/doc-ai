"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useDocumentViewStore } from "./documentViewStore";
import useOrgStore from "./orgStore";

interface DocumentViewProviderProps {
  documentId: string;
  children: ReactNode;
}

export function DocumentViewProvider({
  documentId,
  children,
}: DocumentViewProviderProps) {
  const { org } = useOrgStore();
  const loadedDocumentIdRef = useRef<string | null>(null);

  // Load document when documentId or org changes
  useEffect(() => {
    if (!org?.id) return;

    // Only load if document ID changed
    if (documentId !== loadedDocumentIdRef.current) {
      loadedDocumentIdRef.current = documentId;
      useDocumentViewStore.getState().loadDocument(documentId);
    }
  }, [documentId, org?.id]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      useDocumentViewStore.getState().reset();
    };
  }, []);

  return <>{children}</>;
}

