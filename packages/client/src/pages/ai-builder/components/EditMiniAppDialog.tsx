"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { updateMiniAppApi } from "../../../utilities/api/miniAppApi";
import type { MiniApp } from "@zdocs/types";
import { toast } from "sonner";
import { IconPicker } from "./IconPicker";

type EditMiniAppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  miniApp: MiniApp | null;
  orgId: string;
  onSuccess?: (updated: MiniApp) => void;
};

export function EditMiniAppDialog({
  open,
  onOpenChange,
  miniApp,
  orgId,
  onSuccess,
}: EditMiniAppDialogProps) {
  const t = useTranslations("aiBuilder");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [icon, setIcon] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update form when miniApp changes
  useEffect(() => {
    if (miniApp) {
      setName(miniApp.name || "");
      setDescription(miniApp.description || "");
      setColor(miniApp.color || "#6366f1");
      setIcon(miniApp.icon || null);
    }
  }, [miniApp]);

  const handleSave = async () => {
    if (!miniApp || !name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        name: name.trim(),
        description: description.trim() || null,
        color: color || null,
        icon: icon || null,
      };
      const updated = await updateMiniAppApi(orgId, miniApp.id, updates);
      toast.success(t("miniAppUpdated"));
      onOpenChange(false);
      onSuccess?.(updated);
    } catch (error) {
      console.error("Failed to update Mini App:", error);
      toast.error(t("updateMiniAppFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      if (miniApp) {
        setName(miniApp.name || "");
        setDescription(miniApp.description || "");
        setColor(miniApp.color || "#6366f1");
        setIcon(miniApp.icon || null);
      }
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="edit-miniapp-dialog">
        <DialogHeader>
          <DialogTitle>{t("editMiniAppTitle")}</DialogTitle>
          <DialogDescription>{t("editMiniAppDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-miniapp-name">{t("createMiniAppName")}</Label>
            <Input
              id="edit-miniapp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("createMiniAppNamePlaceholder")}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !isSaving) {
                  handleSave();
                }
              }}
              data-testid="edit-miniapp-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-miniapp-description">
              {t("createMiniAppDescriptionLabel")} ({t("optional")})
            </Label>
            <Textarea
              id="edit-miniapp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createMiniAppDescriptionPlaceholder")}
              disabled={isSaving}
              rows={3}
              data-testid="edit-miniapp-description-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-miniapp-color">
              {t("createMiniAppColor")} ({t("optional")})
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="edit-miniapp-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 cursor-pointer"
                disabled={isSaving}
                data-testid="edit-miniapp-color-input"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#6366f1"
                className="flex-1 font-mono text-sm"
                disabled={isSaving}
                data-testid="edit-miniapp-color-text-input"
              />
            </div>
          </div>

          <IconPicker
            value={icon}
            onChange={setIcon}
            label={`${t("createMiniAppIcon")} (${t("optional")})`}
            disabled={isSaving}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
            data-testid="edit-miniapp-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            data-testid="edit-miniapp-save-btn"
          >
            {isSaving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
