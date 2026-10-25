"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { useTranslations } from "next-intl";

interface DeleteModalProps {
  isOpen: boolean;
  itemId: string;
  itemName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  itemName,
  onClose,
  onConfirm,
}: DeleteModalProps) {
  const t = useTranslations("drive");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="delete-confirmation-modal">
        <DialogHeader>
          <DialogTitle>{t("deleteItem")}</DialogTitle>
          <DialogDescription>
            {t("deleteConfirmation", { name: itemName })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            data-testid="delete-btn"
          >
            {t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
