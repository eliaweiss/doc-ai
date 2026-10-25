"use client";

import { IconDisplay } from "../../ai-builder/components/IconDisplay";
import { cn, getTextColorForBackground, Switch } from "@zdocs/client-component";
import type { LucideIcon } from "lucide-react";

type AppShortcutProps = {
  name: string;
  description?: string;
  icon?: string | null; // Lucide icon name for mini apps
  iconComponent?: LucideIcon; // Lucide icon component for system apps
  color?: string | null; // Hex color for mini apps
  onClick?: () => void;
  testId?: string;
  showEnableSwitch?: boolean;
  isEnabled?: boolean;
  onEnable?: () => void;
  onDisable?: () => void;
  disabled?: boolean;
};

export function AppShortcut({
  name,
  description,
  icon,
  iconComponent: IconComponent,
  color,
  onClick,
  testId,
  showEnableSwitch = false,
  isEnabled = false,
  onEnable,
  onDisable,
  disabled = false,
}: AppShortcutProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleCheckedChange = (checked: boolean) => {
    if (checked && onEnable) {
      onEnable();
    } else if (!checked && onDisable) {
      onDisable();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn("group relative bg-card border border-border rounded-md p-3 cursor-pointer transition-all flex items-center gap-3", disabled ? "bg-muted cursor-not-allowed" : "hover:border-primary hover:shadow-sm")}
      data-testid={testId || `app-shortcut-${name}`}
    >
      {/* Icon */}
      {IconComponent && color && /^#[0-9A-Fa-f]{6}$/.test(color) ? (
        // System app with color
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          <IconComponent
            className="w-4 h-4"
            style={{ color: getTextColorForBackground(color) }}
          />
        </div>
      ) : IconComponent ? (
        // System app without color (fallback)
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <IconComponent className="w-4 h-4 text-primary" />
        </div>
      ) : icon && color && /^#[0-9A-Fa-f]{6}$/.test(color) ? (
        // Mini app with color
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          <IconDisplay
            iconName={icon}
            size={16}
            color={getTextColorForBackground(color)}
          />
        </div>
      ) : (
        // Mini app without color or fallback
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          {icon && <IconDisplay iconName={icon} size={16} />}
        </div>
      )}

      {/* Name */}
      <div className="flex min-w-0 flex-col gap-0 flex-1">

        <h3 className="text-sm font-medium text-foreground truncate ">
          {name}
        </h3>

        {description && (
          <div className="min-w-0">

            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {description}
            </p>
          </div>
        )}
      </div>

      {showEnableSwitch && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn("hidden flex-shrink-0 transition-all md:inline-flex", disabled && "group-hover:border-2 group-hover:border-primary group-hover:rounded-full group-hover:-m-0.5")}
          data-testid={`${testId || `app-shortcut-${name}`}-enable-switch`}
        >
          <Switch
            checked={isEnabled}
            onCheckedChange={handleCheckedChange}
          />
        </div>
      )}
    </div>
  );
}
