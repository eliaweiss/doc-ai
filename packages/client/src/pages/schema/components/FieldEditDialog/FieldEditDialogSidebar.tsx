"use client";

import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import {
  Settings,
  FunctionSquare,
  Code2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useFieldEditDialog, type FieldEditSection } from "./FieldEditDialogProvider";
import { cn } from "../../../../lib/utils";

interface MenuItem {
  id: FieldEditSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function FieldEditDialogSidebar() {
  const t = useTranslations("schema");
  const { selectedSection, setSelectedSection, formData } = useFieldEditDialog();

  const allMenuItems: MenuItem[] = [
    {
      id: "code",
      label: t("formula") || "Formula",
      icon: FunctionSquare,
    },
    {
      id: "coreProperties",
      label: t("coreProperties") || "Core Properties",
      icon: Settings,
    },
    {
      id: "flags",
      label: t("flags") || "Rules & Validation",
      icon: ShieldCheck,
    },
    {
      id: "displayAndBehavior",
      label: t("displayAndBehavior") || "Advanced Settings",
      icon: SlidersHorizontal,
    },
  ];

  // Filter menu items based on field type
  const menuItems = allMenuItems.filter((item) => {
    if (!formData) return true;

    // Formula section only shows for "sum" (for "code" it's merged into General)
    if (item.id === "formula") {
      return formData.type === "sum";
    }

    // Code section only shows for "code" type
    if (item.id === "code") {
      return formData.type === "code";
    }

    return true;
  });

  return (
    <aside
      className="w-64 border-r bg-card flex flex-col"
      data-testid="field-edit-dialog-sidebar"
    >
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedSection === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive && "bg-secondary text-secondary-foreground"
              )}
              onClick={() => setSelectedSection(item.id)}
              data-testid={`field-edit-nav-${item.id}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
