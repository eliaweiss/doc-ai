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
import { fetchRenameDocument } from "../../../utilities/api/fetchRenameDocument";
import { useTranslations } from "next-intl";

interface RenameDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export function RenameDocumentModal({
  isOpen,
  onClose,
  documentId,
  documentName,
}: RenameDocumentModalProps) {
  const [newDocumentName, setNewDocumentName] = React.useState(documentName);
  const t = useTranslations("drive");

  const handleRename = async () => {
    try {
      await fetchRenameDocument({ documentId, fileName: newDocumentName });
      onClose();
    } catch (error) {
      console.error("Error renaming document:", error);
    }
  };

  React.useEffect(() => {
    setNewDocumentName(documentName);
  }, [documentName]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="rename-document-modal">
        <DialogHeader>
          <DialogTitle>{t("renameDocument")}</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          value={newDocumentName}
          onChange={(e) => setNewDocumentName(e.target.value)}
          placeholder={t("enterNewDocumentName")}
          data-testid="document-name-input"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="cancel-btn">
            {t("cancel")}
          </Button>
          <Button
            onClick={handleRename}
            disabled={!newDocumentName || newDocumentName === documentName}
            data-testid="rename-btn"
          >
            {t("rename")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
