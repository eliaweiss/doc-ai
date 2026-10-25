"use client";

import { Settings, Tag, Table } from "lucide-react";
import { useTranslations } from "next-intl";

export type SchemaDetailSection =
  | "settings"
  | "main-fields"
  | "line-items";

interface SchemaDetailSidebarProps {
  activeSection: SchemaDetailSection;
  onSectionChange: (section: SchemaDetailSection) => void;
}

export function SchemaDetailSidebar({
  activeSection,
  onSectionChange,
}: SchemaDetailSidebarProps) {
  const t = useTranslations("schema");

  const sections: Array<{
    id: SchemaDetailSection;
    label: string;
    icon: typeof Settings;
  }> = [
    {
      id: "settings",
      label: t("sectionSetup"),
      icon: Settings,
    },
    {
      id: "main-fields",
      label: t("sectionFields"),
      icon: Tag,
    },
    {
      id: "line-items",
      label: t("sectionTables"),
      icon: Table,
    },
  ];

  return (
    <div
      className="w-64 border-r border-border bg-card flex flex-col"
      data-testid="schema-detail-sidebar"
    >
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {t("sections")}
        </h3>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                data-testid={`schema-detail-section-${section.id}`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                />
                <span className="truncate text-left font-medium">
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
