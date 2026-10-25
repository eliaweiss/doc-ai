import { useEffect, useRef } from "react";

const DYNAMIC_FAVICON_ATTR = "data-dynamic-favicon";

/**
 * Static favicon component that sets the 1Flow logo as favicon
 * Creates an SVG favicon with the 1Flow logo
 */
export function Favicon({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    // Don't run during SSR
    if (typeof document === "undefined") return;

    const bgColor = variant === "dark" ? "#000000" : "#ffffff";
    const textColor = variant === "dark" ? "#ffffff" : "#000000";

    // Create SVG favicon - simplified version with "1F" text
    // Using black background with white text
    const svg = `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="6" fill="${bgColor}" stroke="${textColor}" stroke-width="3"/>
        <text x="16" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${textColor}" text-anchor="middle">1F</text>
      </svg>
    `.trim();

    // Convert SVG to data URL
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const newUrl = URL.createObjectURL(svgBlob);

    // Clean up previous URL if exists
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = newUrl;

    // Remove only our previously created dynamic favicon links
    const existingDynamicLinks = document.querySelectorAll(
      `link[${DYNAMIC_FAVICON_ATTR}]`
    );
    existingDynamicLinks.forEach((link) => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });

    // Hide static favicon links
    const staticLinks = document.querySelectorAll(
      `link[rel="icon"]:not([${DYNAMIC_FAVICON_ATTR}]), link[rel="shortcut icon"]:not([${DYNAMIC_FAVICON_ATTR}])`
    );
    staticLinks.forEach((link) => {
      (link as HTMLLinkElement).setAttribute("data-hidden-by-dynamic", "true");
      (link as HTMLLinkElement).href = "";
    });

    // Create new favicon links
    const createLink = (rel: string) => {
      const link = document.createElement("link");
      link.rel = rel;
      link.href = newUrl;
      link.type = "image/svg+xml";
      link.setAttribute(DYNAMIC_FAVICON_ATTR, "true");
      document.head.appendChild(link);
      return link;
    };

    // Create favicon and apple-touch-icon
    createLink("icon");
    createLink("apple-touch-icon");

    // Clean up on unmount
    return () => {
      const dynamicLinks = document.querySelectorAll(
        `link[${DYNAMIC_FAVICON_ATTR}]`
      );
      dynamicLinks.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  return null;
}
