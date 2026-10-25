"use client";

import { useEffect, useRef, useState } from "react";
import useOrgStore from "../context-providers/orgStore";
import { getTextColorForBackground } from "@zdocs/util";

const DYNAMIC_FAVICON_ATTR = "data-dynamic-favicon";

/**
 * Dynamic favicon component that updates based on the organization color
 * Creates an SVG favicon with the "Z" logo and organization color
 */
export function DynamicFavicon() {
  const { org } = useOrgStore();
  const [isMounted, setIsMounted] = useState(false);
  const urlRef = useRef<string | null>(null);

  // Only run client-side after hydration is complete
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Don't run during SSR or before hydration completes
    if (!isMounted || typeof document === "undefined") return;

    // Default color if no organization color is set
    const bgColor = org?.color || "#6366f1"; // Default primary color
    // Determine text color based on background brightness
    const textColor = getTextColorForBackground(bgColor);

    // Create SVG favicon
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
      link.href = newUrl;
      link.type = "image/svg+xml";
      link.setAttribute(DYNAMIC_FAVICON_ATTR, "true");
      document.head.appendChild(link);
      return link;
    };

    // Create favicon and apple-touch-icon
    createLink("icon");
    createLink("apple-touch-icon");

    // Clean up on unmount or color change
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
  }, [org?.color, isMounted]);

  // Clean up URL on unmount
  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  return null;
}
