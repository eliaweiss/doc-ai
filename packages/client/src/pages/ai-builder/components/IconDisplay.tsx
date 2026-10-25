"use client";

import * as LucideIcons from "lucide-react";
import { cn } from "../../../lib/utils";
import type { LucideIcon } from "lucide-react";

type IconDisplayProps = {
  iconName: string | null;
  className?: string;
  size?: number;
  color?: string | null;
  fallback?: React.ReactNode;
};

export function IconDisplay({
  iconName,
  className,
  size = 16,
  color,
  fallback = null,
}: IconDisplayProps) {
  if (!iconName) {
    return <>{fallback}</>;
  }

  // Try the exact name first, then try with "Icon" suffix for backward compatibility
  let IconComponent = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[
    iconName
  ];

  // If not found and doesn't end with "Icon", try with "Icon" suffix
  if (!IconComponent && !iconName.endsWith("Icon")) {
    IconComponent = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[
      `${iconName}Icon`
    ];
  }

  if (!IconComponent) {
    return <>{fallback}</>;
  }

  return (
    <IconComponent
      className={cn("flex-shrink-0", className)}
      size={size}
      color={color || undefined}
      data-testid={`icon-display-${iconName}`}
    />
  );
}
