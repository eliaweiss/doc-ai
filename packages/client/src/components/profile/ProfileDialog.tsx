"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { ProfileContent } from "./ProfileContent";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="profile-dialog">
        <DialogHeader>
          <DialogTitle>{t("profile.your_profile")}</DialogTitle>
        </DialogHeader>
        <ProfileContent showTitle={false} />
      </DialogContent>
    </Dialog>
  );
}
