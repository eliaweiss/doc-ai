"use client";
import {
  FileText,
  Clock,
  Trash2,
  Edit2,
  FolderIcon,
  Table,
} from "lucide-react";
import { useState } from "react";
import { ContextMenu } from "@zdocs/client-component";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { fetchDeleteDocument } from "../../../utilities/api/fetchDeleteDocument";
import { Document } from "@zdocs/types";
import { RenameDocumentModal } from "./RenameDocumentModal";
import { MoveDocumentModal } from "./MoveDocumentModal";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

interface DocumentTrProps {
  document: Document;
}

export function DocumentTr({ document }: DocumentTrProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("datasets");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
  });

  const isDataset = false; // Dataset pipeline disabled

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.pageX,
      y: e.pageY,
    });
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
    setContextMenu({ show: false, x: 0, y: 0 });
  };

  const handleRenameClick = () => {
    setShowRenameModal(true);
    setContextMenu({ show: false, x: 0, y: 0 });
  };

  const handleMoveClick = () => {
    setShowMoveModal(true);
    setContextMenu({ show: false, x: 0, y: 0 });
  };

  const handleDeleteConfirm = async () => {
    try {
      await fetchDeleteDocument(document.id);
      setShowDeleteConfirmation(false);
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const handleDocumentClick = () => {
    router.push(`/document/${document.id}`);
  };

  const getDocumentTypeLabel = (type: string | null) => {
    if (!type) return "Unknown";
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <>
      <div
        className="flex items-center px-6 py-4 hover:bg-accent cursor-pointer border-b border-border"
        onClick={() => handleDocumentClick()}
        onContextMenu={handleContextMenu}
        data-testid={`document-row-${document.id}`}
      >
        <div className="flex-[2] flex items-center">
          {isDataset ? (
            <Table className="w-5 h-5 mr-2 text-primary" />
          ) : (
            <FileText className="w-5 h-5 mr-2 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {document.fileName}
          </span>
          {isDataset && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              {t("datasetBadge")}
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center">
          <span className="text-sm text-muted-foreground">
            {getDocumentTypeLabel(document.docType)}
          </span>
        </div>
        <div className="flex-1 flex items-center">
          <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {new Date(document.updatedAt).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {contextMenu.show && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ show: false, x: 0, y: 0 })}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
            onClick={handleMoveClick}
            data-testid="document-context-move"
          >
            <FolderIcon className="w-4 h-4 mr-2" />
            Move to
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
            onClick={handleRenameClick}
            data-testid="document-context-rename"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Rename
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-accent flex items-center"
            onClick={handleDeleteClick}
            data-testid="document-context-delete"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </ContextMenu>
      )}

      <DeleteConfirmationModal
        isOpen={showDeleteConfirmation}
        itemId={document.id}
        itemName={document.fileName || ""}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleDeleteConfirm}
      />

      <RenameDocumentModal
        isOpen={showRenameModal}
        documentId={document.id}
        documentName={document.fileName || ""}
        onClose={() => setShowRenameModal(false)}
      />

      <MoveDocumentModal
        isOpen={showMoveModal}
        documentId={document.id}
        documentName={document.fileName || ""}
        onClose={() => setShowMoveModal(false)}
      />
    </>
  );
}
