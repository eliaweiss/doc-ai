"use client";
import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@zdocs/types";
import { DocumentCard } from "./DocumentCard";

interface DocumentsCardViewProps {
  documents: Document[];
  selectedDocumentIds: Set<string>;
  lastSelectedRowIndexRef: React.MutableRefObject<number | null>;
  getDocumentTypeLabel: (type: string | null) => string;
  setSelectedDocumentIds: (ids: Set<string>) => void;
  setContextMenu: (menu: {
    show: boolean;
    x: number;
    y: number;
    document: Document | null;
  }) => void;
  onContainerContextMenu: (e: React.MouseEvent) => void;
  isMobile: boolean;
}

export function DocumentsCardView({
  documents,
  selectedDocumentIds,
  lastSelectedRowIndexRef,
  getDocumentTypeLabel,
  setSelectedDocumentIds,
  setContextMenu,
  onContainerContextMenu,
  isMobile,
}: DocumentsCardViewProps) {
  const router = useRouter();

  const handleCardClick = useCallback(
    (document: Document, event: React.MouseEvent) => {
      // On mobile, single tap navigates directly to the document
      if (isMobile) {
        router.push(`/document/${document.id}`);
        return;
      }

      const mouseEvent = event.nativeEvent as MouseEvent;
      const isShiftPressed = mouseEvent.shiftKey || false;
      const isCtrlPressed = mouseEvent.ctrlKey || mouseEvent.metaKey || false;

      if (isShiftPressed && lastSelectedRowIndexRef.current !== null) {
        // Range selection with Shift+click
        const currentIndex = documents.findIndex((d) => d.id === document.id);
        const startIndex = Math.min(
          lastSelectedRowIndexRef.current,
          currentIndex
        );
        const endIndex = Math.max(lastSelectedRowIndexRef.current, currentIndex);

        const newSelection = new Set(selectedDocumentIds);
        documents
          .slice(startIndex, endIndex + 1)
          .forEach((d) => newSelection.add(d.id));
        setSelectedDocumentIds(newSelection);
        lastSelectedRowIndexRef.current = currentIndex;
      } else if (isCtrlPressed) {
        // Toggle selection with Ctrl/Cmd+click
        const newSelection = new Set(selectedDocumentIds);
        if (newSelection.has(document.id)) {
          newSelection.delete(document.id);
        } else {
          newSelection.add(document.id);
        }
        setSelectedDocumentIds(newSelection);
        const currentIndex = documents.findIndex((d) => d.id === document.id);
        lastSelectedRowIndexRef.current = currentIndex;
      } else {
        // Single click - select only this card
        setSelectedDocumentIds(new Set([document.id]));
        const currentIndex = documents.findIndex((d) => d.id === document.id);
        lastSelectedRowIndexRef.current = currentIndex;
      }
    },
    [documents, selectedDocumentIds, lastSelectedRowIndexRef, setSelectedDocumentIds, isMobile, router]
  );

  const handleCardDoubleClick = useCallback(
    (document: Document) => {
      router.push(`/document/${document.id}`);
    },
    [router]
  );

  const handleCardContextMenu = useCallback(
    (document: Document, event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        show: true,
        x: event.pageX,
        y: event.pageY,
        document,
      });
    },
    [setContextMenu]
  );

  const handleCardDragStart = useCallback(
    (document: Document, event: React.DragEvent) => {
      const documentsToMove = selectedDocumentIds.has(document.id)
        ? documents.filter((d) => selectedDocumentIds.has(d.id))
        : [document];

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          documentIds: documentsToMove.map((d) => d.id),
          documentNames: documentsToMove.map(
            (d) => d.description || d.fileName || "Untitled"
          ),
        })
      );
      (event.target as HTMLElement).style.opacity = "0.5";
    },
    [documents, selectedDocumentIds]
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent) => {
    (event.target as HTMLElement).style.opacity = "1";
  }, []);

  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-3"
      data-testid="documents-grid-container"
      onContextMenu={onContainerContextMenu}
    >
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          isSelected={selectedDocumentIds.has(document.id)}
          getDocumentTypeLabel={getDocumentTypeLabel}
          onClick={(e) => handleCardClick(document, e)}
          onDoubleClick={() => handleCardDoubleClick(document)}
          onContextMenu={(e) => handleCardContextMenu(document, e)}
          onDragStart={(e) => handleCardDragStart(document, e)}
          onDragEnd={handleCardDragEnd}
        />
      ))}
    </div>
  );
}
