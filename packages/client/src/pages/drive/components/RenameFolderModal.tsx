"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { fetchRenameFolder } from "../../../utilities/api/fetchRenameFolder";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface RenameFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
}

export function RenameFolderModal({
  isOpen,
  onClose,
  folderId,
  folderName,
}: RenameFolderModalProps) {
  const [newFolderName, setNewFolderName] = React.useState(folderName);
  const t = useTranslations("drive");

  const handleRename = async () => {
    try {
      await fetchRenameFolder({ folderId, name: newFolderName });
      onClose();
    } catch (error) {
      toast.error(t("failedToRenameFolder"));
      console.error("Error renaming folder:", error);
    }
  };

  React.useEffect(() => {
    setNewFolderName(folderName);
  }, [folderName]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="rename-folder-modal">
        <DialogHeader>
          <DialogTitle>{t("renameFolder")}</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder={t("enterNewFolderName")}
          data-testid="folder-name-input"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="cancel-btn">
            {t("cancel")}
          </Button>
          <Button
            onClick={handleRename}
            disabled={!newFolderName || newFolderName === folderName}
            data-testid="rename-btn"
          >
            {t("rename")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
