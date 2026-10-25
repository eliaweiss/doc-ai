"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import { ENTITY_TYPES, EntityType } from "@zdocs/types";

interface EntityTypeFilterProps {
  selectedTypes: EntityType[];
  onTypesChange: (types: EntityType[]) => void;
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  HEADER: "documentHeader",
  LINE_ITEM: "documentLineItem",
};

export function EntityTypeFilter({
  selectedTypes,
  onTypesChange,
}: EntityTypeFilterProps) {
  const t = useTranslations("search");

  const allSelected = selectedTypes.length === ENTITY_TYPES.length;

  const handleAllChange = (checked: boolean) => {
    if (checked) {
      onTypesChange([...ENTITY_TYPES]);
    } else {
      onTypesChange([]);
    }
  };

  const handleTypeChange = (type: EntityType, checked: boolean) => {
    if (checked) {
      onTypesChange([...selectedTypes, type]);
    } else {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-4"
      data-testid="entity-type-filter"
    >
      <div className="flex items-center gap-2" data-testid="filter-all">
        <Checkbox
          id="filter-all"
          checked={allSelected}
          onCheckedChange={handleAllChange}
        />
        <Label htmlFor="filter-all" className="text-sm font-medium">
          {t("filterAll")}
        </Label>
      </div>

      <div className="w-px h-4 bg-border" />

      {ENTITY_TYPES.map((type) => (
        <div
          key={type}
          className="flex items-center gap-2"
          data-testid={`filter-${type.toLowerCase()}`}
        >
          <Checkbox
            id={`filter-${type}`}
            checked={selectedTypes.includes(type)}
            onCheckedChange={(checked) =>
              handleTypeChange(type, checked as boolean)
            }
          />
          <Label htmlFor={`filter-${type}`} className="text-sm">
            {t(ENTITY_TYPE_LABELS[type])}
          </Label>
        </div>
      ))}
    </div>
  );
}
