"use client";

import React from "react";
import { X, FileText, List, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { SearchableEntityOption } from "@zdocs/types";

interface ActiveFilterChipsProps {
  selectedEntities: SearchableEntityOption[];
  onRemoveEntity: (schemaType: string) => void;
  dateFrom: Date | null;
  dateTo: Date | null;
  onClearDate: () => void;
  isAllSelected: boolean;
}

export function ActiveFilterChips({
  selectedEntities,
  onRemoveEntity,
  dateFrom,
  dateTo,
  onClearDate,
  isAllSelected,
}: ActiveFilterChipsProps) {
  if (isAllSelected && !dateFrom && !dateTo) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {/* Date Chip */}
      {(dateFrom || dateTo) && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground">
          <Calendar className="w-3 h-3" />
          <span>
            {dateFrom ? format(dateFrom, "dd/MM/yy") : "?"} - {dateTo ? format(dateTo, "dd/MM/yy") : "?"}
          </span>
          <button
            onClick={onClearDate}
            className="hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Entity Chips */}
      {!isAllSelected &&
        selectedEntities.map((entity) => {
          const Icon = entity.entityType === "HEADER" ? FileText : List;
          return (
            <div
              key={entity.schemaType}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20"
            >
              <Icon className="w-3 h-3" />
              <span>{entity.displayName}</span>
              <button
                onClick={() => onRemoveEntity(entity.schemaType)}
                className="hover:text-primary-foreground hover:bg-primary rounded-full transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
    </div>
  );
}

