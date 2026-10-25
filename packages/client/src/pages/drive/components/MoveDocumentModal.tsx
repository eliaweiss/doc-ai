"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Loader2, FolderPlus } from "lucide-react";
import { fetchMoveDocument } from "../../../utilities/api/fetchMoveDocument";
import { useDocsStore } from "../../../context-providers/docsStore";
import { FolderSelect } from "./FolderSelect";
import { fetchFolders } from "../../../utilities/api/fetchFolders";
import { createFolder } from "../../../utilities/api/createFolder";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface MoveDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  onMoved?: (folderId: string) => void;
}

export function MoveDocumentModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  onMoved,
}: MoveDocumentModalProps) {
  const router = useRouter();
  const { folderTree, isLoadingFolders } = useDocsStore();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("drive");

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(null);
      setShowNewFolderInput(false);
      setNewFolderName("");
      fetchFolders().catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (showNewFolderInput) {
      setTimeout(() => newFolderInputRef.current?.focus(), 50);
    }
  }, [showNewFolderInput]);

  const handleMove = async () => {
    if (!selectedFolderId) return;
    try {
      await fetchMoveDocument({ documentId, folderId: selectedFolderId });
      onClose();
      if (onMoved) {
        onMoved(selectedFolderId);
      } else {
        router.push(`/folder/${selectedFolderId}`);
      }
    } catch (error) {
      console.error("Error moving document:", error);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error(t("folderNameRequired"));
      return;
    }
    setIsCreating(true);
    try {
      const newFolderId = await createFolder(name, selectedFolderId);
      setSelectedFolderId(newFolderId);
      setShowNewFolderInput(false);
      setNewFolderName("");
      toast.success(t("folderCreated"));
    } catch {
      toast.error(t("failedToCreateFolder"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreateFolder();
    if (e.key === "Escape") {
      setShowNewFolderInput(false);
      setNewFolderName("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="move-document-modal"
        className="flex flex-col sm:max-w-[425px]"
      >
        <DialogHeader>
          <DialogTitle>{t("moveDocument", { name: documentName })}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3" data-testid="move-document-modal-content">
          <div
            className="max-h-[280px] overflow-y-auto border border-border rounded-md p-2 min-h-[100px] flex flex-col custom-scrollbar"
            data-testid="move-document-folder-list"
          >
            {isLoadingFolders && folderTree.length === 0 ? (
              <div
                className="flex-1 flex items-center justify-center p-8"
                data-testid="move-document-loading"
              >
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : folderTree.length > 0 ? (
              folderTree.map((folder) => (
                <FolderSelect
                  key={folder.id}
                  folder={folder}
                  selectedFolderId={selectedFolderId}
                  onSelect={setSelectedFolderId}
                />
              ))
            ) : (
              <div
                className="flex-1 flex items-center justify-center p-8 text-muted-foreground text-sm"
                data-testid="move-document-no-folders"
              >
                {t("noFolders")}
              </div>
            )}
          </div>

          {showNewFolderInput ? (
            <div className="flex items-center gap-2" data-testid="move-document-new-folder-row">
              <Input
                ref={newFolderInputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleNewFolderKeyDown}
                placeholder={t("enterFolderName")}
                className="h-8 text-sm"
                disabled={isCreating}
                data-testid="move-document-new-folder-input"
              />
              <Button
                size="sm"
                onClick={handleCreateFolder}
                disabled={isCreating || !newFolderName.trim()}
                className="shrink-0"
                data-testid="move-document-create-folder-btn"
              >
                {isCreating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  t("create")
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowNewFolderInput(false); setNewFolderName(""); }}
                disabled={isCreating}
                className="shrink-0"
                data-testid="move-document-cancel-create-btn"
              >
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowNewFolderInput(true)}
              data-testid="move-document-show-new-folder-btn"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              {t("newFolder")}
            </button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="cancel-btn"
            className="w-full sm:w-auto"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedFolderId}
            data-testid="move-btn"
            className="w-full sm:w-auto"
          >
            {t("move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
