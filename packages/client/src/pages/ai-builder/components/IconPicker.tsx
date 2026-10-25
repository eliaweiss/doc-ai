"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import * as LucideIcons from "lucide-react";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { Search, X } from "lucide-react";
import { cn } from "../../../lib/utils";

type IconPickerProps = {
  value: string | null;
  onChange: (iconName: string | null) => void;
  label?: string;
  disabled?: boolean;
};

// Get all Lucide icon names (excluding non-icon exports)
const getAllIconNames = (): string[] => {
  const iconNames: string[] = [];
  const excludedNames = new Set([
    "Icon",
    "IconNode",
    "createLucideIcon",
    "LucideIcon",
    "IconProps",
  ]);

  for (const [name, IconComponent] of Object.entries(LucideIcons)) {
    // Filter out non-icon exports
    // Icons are React forwardRef components (objects with render property)
    // or functions, and they start with uppercase letter
    const isReactComponent =
      (typeof IconComponent === "object" &&
        IconComponent !== null &&
        "render" in IconComponent) ||
      typeof IconComponent === "function";

    if (
      isReactComponent &&
      name[0] === name[0].toUpperCase() &&
      !name.startsWith("Lucide") &&
      !name.endsWith("Icon") && // Exclude duplicate Icon suffixed versions
      !excludedNames.has(name)
    ) {
      iconNames.push(name);
    }
  }
  return iconNames.sort();
};

const ALL_ICONS = getAllIconNames();

export function IconPicker({
  value,
  onChange,
  label,
  disabled = false,
}: IconPickerProps) {
  const t = useTranslations("aiBuilder");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return ALL_ICONS;
    }
    const query = searchQuery.toLowerCase();
    return ALL_ICONS.filter((name) => name.toLowerCase().includes(query));
  }, [searchQuery]);

  const SelectedIcon = value
    ? (LucideIcons[value as keyof typeof LucideIcons] as
        | React.ComponentType<{ className?: string; size?: number }>
        | undefined)
    : null;

  const handleSelectIcon = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="flex items-center gap-2"
          data-testid="icon-picker-trigger"
        >
          {SelectedIcon ? (
            <>
              <SelectedIcon className="w-4 h-4" />
              <span className="text-sm">{value}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t("selectIcon")}
            </span>
          )}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
            className="h-9 w-9"
            data-testid="icon-picker-clear"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setSearchQuery(""); // Reset search when dialog closes
          }
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[80vh]"
          data-testid="icon-picker-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("selectIcon")}</DialogTitle>
            <DialogDescription>{t("selectIconDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchIconsPlaceholder")}
                className="pl-10"
                data-testid="icon-picker-search"
                autoFocus
              />
            </div>

            {/* Icons Grid */}
            <div className="border border-border rounded-lg p-4 max-h-[50vh] overflow-y-auto">
              {filteredIcons.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t("noIconsFound")}
                </div>
              ) : (
                <div
                  className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2"
                  data-testid="icon-picker-grid"
                >
                  {filteredIcons.map((iconName) => {
                    const IconComponent = LucideIcons[
                      iconName as keyof typeof LucideIcons
                    ] as React.ComponentType<{
                      className?: string;
                      size?: number;
                    }>;
                    const isSelected = value === iconName;

                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => handleSelectIcon(iconName)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-md border transition-colors hover:bg-accent",
                          isSelected
                            ? "bg-accent border-primary"
                            : "border-border hover:border-primary/50"
                        )}
                        data-testid={`icon-picker-item-${iconName}`}
                      >
                        {IconComponent && (
                          <IconComponent className="w-5 h-5 mb-1" />
                        )}
                        <span className="text-xs truncate w-full text-center">
                          {iconName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
