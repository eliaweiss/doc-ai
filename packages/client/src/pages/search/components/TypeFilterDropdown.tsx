"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Filter, FileText, List } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zdocs/client-component";
import type { SearchableEntityOption } from "@zdocs/types";

interface TypeFilterDropdownProps {
  entities: SearchableEntityOption[];
  selectedKeys: string[];
  onSelectionChange: (
    keys: string[],
    entities: SearchableEntityOption[]
  ) => void;
  disabled?: boolean;
}

export function TypeFilterDropdown({
  entities,
  selectedKeys,
  onSelectionChange,
  disabled = false,
}: TypeFilterDropdownProps) {
  const t = useTranslations("search");

  const allKeys = useMemo(() => entities.map((e) => e.schemaType), [entities]);
  const isAllSelected =
    selectedKeys.length === entities.length &&
    allKeys.every((k) => selectedKeys.includes(k));

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(allKeys, entities);
    } else {
      onSelectionChange([], []);
    }
  };

  const handleToggleKey = (key: string, checked: boolean) => {
    const newKeys = checked
      ? [...selectedKeys, key]
      : selectedKeys.filter((k) => k !== key);

    const newEntities = entities.filter((e) => newKeys.includes(e.schemaType));
    onSelectionChange(newKeys, newEntities);
  };

  const triggerLabel = isAllSelected
    ? t("filterAll")
    : `${t("filters")} (${selectedKeys.length})`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || entities.length === 0}
          className="h-10 gap-2"
        >
          <Filter className="w-4 h-4" />
          <span className="max-w-[120px] truncate">{triggerLabel}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm transition-colors">
            <Checkbox
              id="select-all-types"
              checked={isAllSelected}
              onCheckedChange={handleToggleAll}
            />
            <label
              htmlFor="select-all-types"
              className="text-sm font-medium leading-none cursor-pointer flex-1"
            >
              {t("filterAll")}
            </label>
          </div>
          <div className="h-px bg-border my-1" />
          <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1">
            {entities.map((entity) => {
              const Icon = entity.entityType === "HEADER" ? FileText : List;
              const isSelected = selectedKeys.includes(entity.schemaType);
              return (
                <div
                  key={entity.schemaType}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm transition-colors"
                >
                  <Checkbox
                    id={`type-${entity.schemaType}`}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      handleToggleKey(entity.schemaType, !!checked)
                    }
                  />
                  <label
                    htmlFor={`type-${entity.schemaType}`}
                    className="text-sm font-medium leading-none cursor-pointer flex-1 flex items-center gap-2"
                  >
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <span>{entity.displayName}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
