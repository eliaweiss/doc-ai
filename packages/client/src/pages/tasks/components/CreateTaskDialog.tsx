"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { useTasksPage } from "../context/TasksPageProvider";

export function CreateTaskDialog() {
  const t = useTranslations("tasks");
  const { isCreateDialogOpen, setIsCreateDialogOpen, createTask } = useTasksPage();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = () => {
    setName("");
    setDescription("");
    setIsCreateDialogOpen(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      await createTask(name.trim(), description.trim() || null);
    } catch (err) {
      // Error handled by provider
    } finally {
      setIsCreating(false);
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={isCreateDialogOpen} onOpenChange={handleClose}>
      <DialogContent data-testid="create-task-dialog">
        <DialogHeader>
          <DialogTitle>{t("createTask")}</DialogTitle>
          <DialogDescription>{t("createTaskDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">{t("taskName")}</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("taskNamePlaceholder")}
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid && !isCreating) {
                  handleCreate();
                }
              }}
              data-testid="create-task-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">
              {t("taskDescription")} ({t("optional")})
            </Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("taskDescriptionPlaceholder")}
              disabled={isCreating}
              rows={3}
              data-testid="create-task-description-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating}
            data-testid="create-task-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || isCreating}
            data-testid="create-task-submit-btn"
          >
            {isCreating ? t("creating") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
