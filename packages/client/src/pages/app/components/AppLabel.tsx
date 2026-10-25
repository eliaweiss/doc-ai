import { cn } from "@zdocs/util";

interface AppLabelProps {
  name: string;
  className?: string;
}

/**
 * Helper function to truncate text for mobile display
 */
const truncateForMobile = (text: string | null | undefined): string => {
  if (!text) return "";
  if (text.length <= 4) return text;
  return text.slice(0, 4) + "...";
};

/**
 * Generic component for rendering app labels
 * Shows full name on desktop, truncated on mobile
 */
export function AppLabel({ name, className }: AppLabelProps) {
  return (
    <>
      <span className={cn("hidden md:inline text-sm text-foreground", className)}>
        {name}
      </span>
      <span className={cn("inline md:hidden text-sm text-foreground", className)}>
        {truncateForMobile(name)}
      </span>
    </>
  );
}
