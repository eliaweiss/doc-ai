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
import { fetchCreateFolder } from "../../../utilities/api/fetchCreateFolder";
import { useDocsStore } from "../../../context-providers/docsStore";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
}: CreateFolderModalProps) {
  const { currentFolderId } = useDocsStore();
  const t = useTranslations("drive");

  const [folderName, setFolderName] = React.useState("");

  const handleCreate = () => {
    if (folderName.trim() === "") {
      toast.error(t("folderNameRequired"));
      return;
    }
    console.log("Creating folder:", folderName);
    onClose();
    setFolderName("");
    fetchCreateFolder({ parentId: currentFolderId, name: folderName });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="create-folder-modal">
        <DialogHeader>
          <DialogTitle>{t("createNewFolder")}</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCreate();
            }
          }}
          placeholder={t("enterFolderName")}
          data-testid="folder-name-input"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="cancel-btn">
            {t("cancel")}
          </Button>
          <Button onClick={handleCreate} data-testid="create-btn">
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
