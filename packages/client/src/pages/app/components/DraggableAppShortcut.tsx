"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { AppShortcut } from "../../apps/components/AppShortcut";
import type { LucideIcon } from "lucide-react";

type DraggableAppShortcutProps = {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
  iconComponent?: LucideIcon;
  color?: string | null;
  onClick?: () => void;
  testId?: string;
  showEnableSwitch?: boolean;
  isEnabled?: boolean;
  onEnable?: () => void;
  onDisable?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
};

export function DraggableAppShortcut({
  id,
  name,
  description,
  icon,
  iconComponent,
  color,
  onClick,
  testId,
  showEnableSwitch,
  isEnabled,
  onEnable,
  onDisable,
  onEdit,
  onDelete,
  onArchive,
}: DraggableAppShortcutProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isDragging ? "cursor-grabbing" : ""}`}
      data-testid={`draggable-app-shortcut-${id}`}
    >
      <div className="relative">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-3 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          data-testid={`drag-handle-${id}`}
        >
          <div className="bg-background border border-border rounded-md p-0 py-1">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <AppShortcut
          name={name}
          description={description}
          icon={icon}
          iconComponent={iconComponent}
          color={color}
          onClick={onClick}
          testId={testId}
          showEnableSwitch={showEnableSwitch}
          isEnabled={isEnabled}
          onEnable={onEnable}
          onDisable={onDisable}
          onEdit={onEdit}
          onDelete={onDelete}
          onArchive={onArchive}
        />
      </div>
    </div>
  );
}
