"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { FolderSelect } from "../../drive/components/FolderSelect";
import { useDocsStore } from "../../../context-providers/docsStore";
import { fetchFolders } from "../../../utilities/api/fetchFolders";
import { createFolder } from "../../../utilities/api/createFolder";
import { Loader2, FolderPlus } from "lucide-react";
import { toast } from "sonner";

interface FolderSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
  selectedFolderId: string | null;
  title?: string;
}

export function FolderSelectDialog({
  isOpen,
  onClose,
  onSelect,
  selectedFolderId,
  title,
}: FolderSelectDialogProps) {
  const t = useTranslations("schema");
  const driveT = useTranslations("drive");
  const { folderTree, isLoadingFolders } = useDocsStore();
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedFolderId);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSelectedId(selectedFolderId);
      setShowNewFolderInput(false);
      setNewFolderName("");
      fetchFolders().catch(console.error);
    }
  }, [isOpen, selectedFolderId]);

  useEffect(() => {
    if (showNewFolderInput) {
      setTimeout(() => newFolderInputRef.current?.focus(), 50);
    }
  }, [showNewFolderInput]);

  const handleConfirm = () => {
    onSelect(localSelectedId);
    onClose();
  };

  const handleDoubleClickConfirm = (folderId: string) => {
    setLocalSelectedId(folderId);
    onSelect(folderId);
    onClose();
  };

  const handleClear = () => {
    setLocalSelectedId(null);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error(driveT("folderNameRequired"));
      return;
    }
    setIsCreating(true);
    try {
      const newFolderId = await createFolder(name, localSelectedId);
      setLocalSelectedId(newFolderId);
      setShowNewFolderInput(false);
      setNewFolderName("");
      toast.success(driveT("folderCreated"));
    } catch {
      toast.error(driveT("failedToCreateFolder"));
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
        data-testid="folder-select-dialog"
        className="sm:max-w-[425px]"
      >
        <DialogHeader>
          <DialogTitle>{title || t("selectDefaultFolder")}</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="max-h-[280px] overflow-y-auto border border-border rounded-md p-2 min-h-[100px] flex flex-col custom-scrollbar">
            {isLoadingFolders && folderTree.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : folderTree.length > 0 ? (
              folderTree.map((folder) => (
                <FolderSelect
                  key={folder.id}
                  folder={folder}
                  selectedFolderId={localSelectedId}
                  onSelect={setLocalSelectedId}
                  onConfirm={handleDoubleClickConfirm}
                />
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground text-sm">
                {driveT("noFolders")}
              </div>
            )}
          </div>

          {/* New folder input */}
          {showNewFolderInput ? (
            <div className="flex items-center gap-2" data-testid="new-folder-input-row">
              <Input
                ref={newFolderInputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleNewFolderKeyDown}
                placeholder={driveT("enterFolderName")}
                className="h-8 text-sm"
                disabled={isCreating}
                data-testid="new-folder-name-input"
              />
              <Button
                size="sm"
                onClick={handleCreateFolder}
                disabled={isCreating || !newFolderName.trim()}
                className="shrink-0"
                data-testid="new-folder-create-btn"
              >
                {isCreating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  driveT("create")
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowNewFolderInput(false); setNewFolderName(""); }}
                disabled={isCreating}
                className="shrink-0"
                data-testid="new-folder-cancel-btn"
              >
                {driveT("cancel")}
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowNewFolderInput(true)}
              data-testid="show-new-folder-input-btn"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              {driveT("newFolder")}
            </button>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!localSelectedId}
            data-testid="clear-folder-btn"
          >
            {t("clearSelection")}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="cancel-btn"
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleConfirm} data-testid="confirm-btn">
              {t("confirm")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
