"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { fetchMoveFolder } from "../../../utilities/api/fetchMoveFolder";
import { useDocsStore } from "../../../context-providers/docsStore";
import { FolderSelect } from "./FolderSelect";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface MoveFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
}

export function MoveFolderModal({
  isOpen,
  onClose,
  folderId,
  folderName,
}: MoveFolderModalProps) {
  const { folderTree } = useDocsStore();
  const [selectedFolderId, setSelectedFolderId] = React.useState<string | null>(
    null
  );
  const t = useTranslations("drive");

  const handleMove = async () => {
    if (!selectedFolderId) return;
    try {
      await fetchMoveFolder({ folderId, parentId: selectedFolderId });
      onClose();
    } catch (error) {
      toast.error(t("failedToMoveFolder"));
      console.error("Error moving folder:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="move-folder-modal">
        <DialogHeader>
          <DialogTitle>{t("moveFolder", { name: folderName })}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[300px] overflow-y-auto border border-border rounded p-2">
          {folderTree.map(
            (folder) =>
              folder.id !== folderId && (
                <FolderSelect
                  key={folder.id}
                  folder={folder}
                  selectedFolderId={selectedFolderId}
                  onSelect={setSelectedFolderId}
                  excludeFolderId={folderId}
                />
              )
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="cancel-btn">
            {t("cancel")}
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedFolderId}
            data-testid="move-btn"
          >
            {t("move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
