"use client";

import { useEffect, useRef, useState } from "react";

const DYNAMIC_FAVICON_ATTR = "data-dynamic-favicon";

/**
 * DocVision favicon component that sets the Doc Vision logo as favicon
 * Uses the doc-vision-logo-black.svg from the public folder
 */
export function DocVisionFavicon() {
  const [isMounted, setIsMounted] = useState(false);

  // Only run client-side after hydration is complete
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Don't run during SSR or before hydration completes
    if (!isMounted || typeof document === "undefined") return;

    // Use the SVG file from public folder
    const faviconPath = "/logo/doc-vision-logo-black.svg";

    // Remove only our previously created dynamic favicon links (not Next.js static ones)
    const existingDynamicLinks = document.querySelectorAll(
      `link[${DYNAMIC_FAVICON_ATTR}]`
    );
    existingDynamicLinks.forEach((link) => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });

    // Hide static favicon links instead of removing them (prevents React reconciliation issues)
    const staticLinks = document.querySelectorAll(
      `link[rel="icon"]:not([${DYNAMIC_FAVICON_ATTR}]), link[rel="shortcut icon"]:not([${DYNAMIC_FAVICON_ATTR}])`
    );
    staticLinks.forEach((link) => {
      (link as HTMLLinkElement).setAttribute("data-hidden-by-dynamic", "true");
      (link as HTMLLinkElement).href = "";
    });

    // Create new favicon links with our marker attribute
    const createLink = (rel: string) => {
      const link = document.createElement("link");
      link.rel = rel;
      link.href = faviconPath;
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
      // Remove only our dynamic links
      const dynamicLinks = document.querySelectorAll(
        `link[${DYNAMIC_FAVICON_ATTR}]`
      );
      dynamicLinks.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [isMounted]);

  return null;
}
