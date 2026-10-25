"use client";

import { useState, useEffect } from "react";

/**
 * React hook to detect if the screen is mobile width (< 768px)
 * Updates reactively when window is resized
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const isMobile = useMobileScreen();
 *   return <div>{isMobile ? "Mobile" : "Desktop"}</div>;
 * }
 * ```
 */
export function useMobileScreen(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    checkMobile();

    // Listen for resize events
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile;
}
