"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, FileText, List, Plus } from "lucide-react";
import { Checkbox } from "@zdocs/client-component";
import type { SearchableEntityOption } from "@zdocs/types";
import { cn, getHeaderEntityByDoctype } from "@zdocs/util";

interface EntitySelectorProps {
  entities: SearchableEntityOption[];
  selectedKeys: string[];
  onSelectionChange: (
    keys: string[],
    entities: SearchableEntityOption[]
  ) => void;
  disabled?: boolean;
  singleSelect?: boolean;
  hideAllOption?: boolean;
  /**
   * When true, unselected options are hidden behind a + button (dropdown)
   * instead of displayed as inline tags. Useful for compact layouts.
   */
  compactUnselected?: boolean;
}

export function EntitySelector({
  entities,
  selectedKeys,
  onSelectionChange,
  disabled = false,
  singleSelect = false,
  hideAllOption = false,
  compactUnselected = false,
}: EntitySelectorProps) {
  const t = useTranslations("search");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  // "All" mode: when true, all types are implicitly selected
  const allKeys = useMemo(() => entities.map((e) => e.schemaType), [entities]);
  const isAllMode =
    !singleSelect &&
    selectedKeys.length === entities.length &&
    allKeys.every((k) => selectedKeys.includes(k));

  // Create a map for quick entity lookup by schemaType
  const entityMap = useMemo(() => {
    const map = new Map<string, SearchableEntityOption>();
    for (const entity of entities) {
      map.set(entity.schemaType, entity);
    }
    return map;
  }, [entities]);

  // Get selected entities in order
  const selectedEntities = useMemo(() => {
    return selectedKeys
      .map((key) => entityMap.get(key))
      .filter(Boolean) as SearchableEntityOption[];
  }, [selectedKeys, entityMap]);

  // Get unselected entities
  const unselectedEntities = useMemo(() => {
    return entities.filter((e) => !selectedKeys.includes(e.schemaType));
  }, [entities, selectedKeys]);

  // Handle "All" checkbox change
  const handleAllChange = (checked: boolean) => {
    if (checked) {
      onSelectionChange(allKeys, entities);
    } else {
      onSelectionChange([], []);
    }
  };

  // Add an entity to selection
  const addEntity = (key: string) => {
    if (singleSelect) {
      const entity = entityMap.get(key);
      if (entity) {
        onSelectionChange([key], [entity]);
      }
    } else if (!selectedKeys.includes(key)) {
      const entity = entityMap.get(key);
      if (entity) {
        onSelectionChange(
          [...selectedKeys, key],
          [...selectedEntities, entity]
        );
      }
    }
    setShowDropdown(false);
  };

  // Remove an entity from selection
  const removeEntity = (key: string) => {
    const entity = entityMap.get(key);
    if (entity) {
      onSelectionChange(
        selectedKeys.filter((k) => k !== key),
        selectedEntities.filter((e) => e.schemaType !== key)
      );
    }
  };

  const getEntityByDoctype = (docType: string) => {
    return getHeaderEntityByDoctype(docType, entities);
  };

  const displayEntityName = (entity: SearchableEntityOption) => {
    if (entity.entityType === "LINE_ITEM") {
      const parentEntity = getEntityByDoctype(entity.docType);
      if (parentEntity) {
        return `${entity.displayName} (${parentEntity.displayName})`;
      }
      return entity.displayName;
    }
    return entity.displayName;
  };

  return (
    <div className="flex flex-col gap-3" data-testid="entity-selector">
      {/* All Checkbox - only show in multi-select mode */}
      {!singleSelect && !hideAllOption && (
        <div
          className={`flex items-center gap-2 ${disabled || entities.length === 0
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer"
            }`}
          data-testid="entity-selector-all-checkbox"
        >
          <Checkbox
            checked={isAllMode}
            onCheckedChange={handleAllChange}
            disabled={disabled || entities.length === 0}
            data-testid="entity-selector-all"
          />
          <span
            onClick={() => {
              if (!disabled && entities.length > 0) {
                handleAllChange(!isAllMode);
              }
            }}
            className="text-sm font-medium text-foreground select-none cursor-pointer"
          >
            {t("filterAll")}
          </span>
        </div>
      )}

      {/* Tag selection area */}
      {(!isAllMode || singleSelect) && (
        <div
          className={cn(
            "",
            singleSelect && selectedEntities.length > 0
              ? ""
              : compactUnselected
                ? ""
                : "border border-border rounded-md p-2 bg-background"
          )}
          data-testid="entity-selector-container"
        >
          {/* Selected tags */}
          {selectedEntities.length > 0 && (
            <div
              className={cn(
                "flex flex-wrap gap-1.5",
                singleSelect && selectedEntities.length > 0
                  ? ""
                  : compactUnselected
                    ? ""
                    : "mb-2 pb-2 border-b border-border"
              )}
              data-testid="entity-selector-selected"
            >
              {selectedEntities.map((entity) => {
                const Icon = entity.entityType === "HEADER" ? FileText : List;
                return (
                  <button
                    key={entity.schemaType}
                    onClick={() => removeEntity(entity.schemaType)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50"
                    data-testid={`entity-tag-${entity.schemaType}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">
                      {displayEntityName(entity)}
                    </span>
                    <X className="w-3 h-3" />
                  </button>
                );
              })}

              {/* Compact: + button to add more types */}
              {compactUnselected && !singleSelect && unselectedEntities.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown((prev) => !prev)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                    data-testid="entity-selector-add-btn"
                    title="Add entity type"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {showDropdown && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md min-w-[180px] max-h-[240px] overflow-y-auto"
                      data-testid="entity-selector-dropdown">
                      {unselectedEntities.map((entity) => {
                        const Icon = entity.entityType === "HEADER" ? FileText : List;
                        return (
                          <button
                            key={entity.schemaType}
                            onClick={() => addEntity(entity.schemaType)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                            data-testid={`entity-option-${entity.schemaType}`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="truncate">{displayEntityName(entity)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No entities selected yet: always show available options inline */}
          {selectedEntities.length === 0 && (
            <>
              {!(singleSelect && selectedEntities.length > 0) &&
                unselectedEntities.length > 0 ? (
                <div
                  className="flex flex-wrap gap-1.5"
                  data-testid="entity-selector-available"
                >
                  {unselectedEntities.map((entity) => {
                    const Icon = entity.entityType === "HEADER" ? FileText : List;
                    return (
                      <button
                        key={entity.schemaType}
                        onClick={() => addEntity(entity.schemaType)}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                        data-testid={`entity-option-${entity.schemaType}`}
                      >
                        <Icon className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">
                          {displayEntityName(entity)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : selectedEntities.length > 0 && singleSelect ? null : (
                <div
                  className="text-xs text-muted-foreground text-center py-1"
                  data-testid="entity-selector-empty"
                >
                  {t("allTypesSelected")}
                </div>
              )}
            </>
          )}

          {/* Standard multi-select: show unselected options when items already selected */}
          {!compactUnselected && !singleSelect && selectedEntities.length > 0 && unselectedEntities.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border"
              data-testid="entity-selector-available"
            >
              {unselectedEntities.map((entity) => {
                const Icon = entity.entityType === "HEADER" ? FileText : List;
                return (
                  <button
                    key={entity.schemaType}
                    onClick={() => addEntity(entity.schemaType)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                    data-testid={`entity-option-${entity.schemaType}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">
                      {displayEntityName(entity)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
