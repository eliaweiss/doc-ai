"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
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
import { useMiniApp } from "../context/MiniAppProvider";
import { IconPicker } from "./IconPicker";

type CreateMiniAppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CreateMiniAppDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateMiniAppDialogProps) {
  const t = useTranslations("aiBuilder");
  const { startNewMiniApp } = useMiniApp();
  const { logEvent } = useLogUserJourneyEvent();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [icon, setIcon] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const hasLoggedOpen = useRef(false);

  useEffect(() => {
    if (open && !hasLoggedOpen.current) {
      hasLoggedOpen.current = true;
      logEvent({
        eventType: "create_app_dialog_opened",
        eventData: { page: "apps" },
      });
    }
    if (!open) {
      hasLoggedOpen.current = false;
    }
  }, [open, logEvent]);

  const handleCreate = async () => {
    if (!name.trim()) {
      return;
    }

    logEvent({
      eventType: "create_app_form_submitted",
      eventData: { hasDescription: !!description.trim(), hasIcon: !!icon },
    });

    setIsCreating(true);
    try {
      await startNewMiniApp(
        name.trim(),
        description.trim() || undefined,
        color || null,
        icon
      );
      logEvent({
        eventType: "create_app_success",
      });
      setName("");
      setDescription("");
      setColor("#6366f1");
      setIcon(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      logEvent({
        eventType: "create_app_error",
      });
      console.error("Failed to create Mini App:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setName("");
      setDescription("");
      setColor("#6366f1");
      setIcon(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="create-miniapp-dialog">
        <DialogHeader>
          <DialogTitle>{t("createMiniAppTitle")}</DialogTitle>
          <DialogDescription>{t("createMiniAppDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="miniapp-name">{t("createMiniAppName")}</Label>
            <Input
              id="miniapp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("createMiniAppNamePlaceholder")}
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !isCreating) {
                  handleCreate();
                }
              }}
              data-testid="create-miniapp-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miniapp-description">
              {t("createMiniAppDescriptionLabel")} ({t("optional")})
            </Label>
            <Textarea
              id="miniapp-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("createMiniAppDescriptionPlaceholder")}
              disabled={isCreating}
              rows={3}
              data-testid="create-miniapp-description-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miniapp-color">
              {t("createMiniAppColor")} ({t("optional")})
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="miniapp-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 cursor-pointer"
                disabled={isCreating}
                data-testid="create-miniapp-color-input"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#6366f1"
                className="flex-1 font-mono text-sm"
                disabled={isCreating}
                data-testid="create-miniapp-color-text-input"
              />
            </div>
          </div>

          <IconPicker
            value={icon}
            onChange={setIcon}
            label={`${t("createMiniAppIcon")} (${t("optional")})`}
            disabled={isCreating}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating}
            data-testid="create-miniapp-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            data-testid="create-miniapp-create-btn"
          >
            {isCreating ? t("creating") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
