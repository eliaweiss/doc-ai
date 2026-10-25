"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

interface AddFieldCardProps {
  onClick: () => void;
}

export function AddFieldCard({ onClick }: AddFieldCardProps) {
  const t = useTranslations("schema");

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-md border-2 border-dashed border-border bg-card/50 hover:bg-accent/30 hover:border-primary/50 transition-all w-full group"
      data-testid="add-field-card"
    >
      <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {t("addField")}
      </span>
    </button>
  );
}

