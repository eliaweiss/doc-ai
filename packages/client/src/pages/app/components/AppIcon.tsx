import type { LucideIcon } from "lucide-react";
import { EclipseIcon } from "lucide-react";
import { IconDisplay } from "../../ai-builder/components/IconDisplay";
import { getTextColorForBackground } from "@zdocs/util";
import { isValidHexColor } from "./types";
import { cn } from "@zdocs/util";

interface AppIconProps {
  icon?: LucideIcon;
  iconName?: string | null;
  color?: string;
  isMiniApp: boolean;
  size?: number;
  className?: string;
}

/**
 * Generic component for rendering app icons
 * Handles both system apps (LucideIcon) and mini apps (icon name string)
 * Supports colored backgrounds when a valid hex color is provided
 */
export function AppIcon({
  icon,
  iconName,
  color = "#ffffff",
  isMiniApp,
  size = 16,
  className,
}: AppIconProps) {
  const hasValidColor = isValidHexColor(color);
  const IconComponent = icon || EclipseIcon;

  if (hasValidColor) {
    // Render with colored background
    if (isMiniApp && iconName) {
      // Mini app with icon name
      return (
        <div
          className={cn(
            "rounded flex items-center justify-center flex-shrink-0",
            className
          )}
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
        >
          <IconDisplay
            iconName={iconName}
            size={size * 0.75}
            color={getTextColorForBackground(color)}
          />
        </div>
      );
    } else {
      // System app with LucideIcon
      return (
        <div
          className={cn(
            "rounded flex items-center justify-center flex-shrink-0",
            className
          )}
          style={{
            width: size,
            height: size,
            backgroundColor: color!,
          }}
        >
          <IconComponent
            className="w-3 h-3"
            style={{
              color: getTextColorForBackground(color!),
            }}
          />
        </div>
      );
    }
  }

  // Render without colored background
  return (
    <IconComponent
      className={cn("text-muted-foreground flex-shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
