"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@zdocs/util";
import { useMobileScreen } from "../../hooks/useMobileScreen";

const STORAGE_PREFIX = "resizable-split-pane-";

type HidePaneMode = "none" | "left" | "right";

interface ResizableSplitPaneProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  initialLeftWidthPercent?: number;
  minLeftWidthPercent?: number;
  maxLeftWidthPercent?: number;
  storageKey?: string; // Key to persist ratio in localStorage
  hidePane?: HidePaneMode; // Hide one pane and show the other fullscreen
}

function getStoredWidth(
  storageKey: string | undefined,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (!storageKey || typeof window === "undefined") return defaultValue;

  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= min && parsed <= max) {
        return parsed;
      }
    }
  } catch {
    // localStorage might not be available
  }
  return defaultValue;
}

function saveStoredWidth(storageKey: string | undefined, value: number): void {
  if (!storageKey || typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_PREFIX + storageKey, value.toString());
  } catch {
    // localStorage might not be available
  }
}

export function ResizableSplitPane({
  leftPane,
  rightPane,
  initialLeftWidthPercent = 50,
  minLeftWidthPercent = 20,
  maxLeftWidthPercent = 80,
  storageKey,
  hidePane = "none",
}: ResizableSplitPaneProps) {
  const [leftWidthPercent, setLeftWidthPercent] = useState(() =>
    getStoredWidth(
      storageKey,
      initialLeftWidthPercent,
      minLeftWidthPercent,
      maxLeftWidthPercent
    )
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useMobileScreen();
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs to avoid stale closures in event handlers
  const isDraggingRef = useRef(false);
  const leftWidthPercentRef = useRef(leftWidthPercent);

  // Keep refs in sync with state
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    leftWidthPercentRef.current = leftWidthPercent;
  }, [leftWidthPercent]);

  // Track mount state for portal rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp the value
      const clampedWidth = Math.min(
        maxLeftWidthPercent,
        Math.max(minLeftWidthPercent, newLeftWidth)
      );

      setLeftWidthPercent(clampedWidth);
    },
    [minLeftWidthPercent, maxLeftWidthPercent]
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      saveStoredWidth(storageKey, leftWidthPercentRef.current);
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }, [storageKey]);

  // Add global event listeners on mount, not on drag start
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const onMouseUp = () => handleMouseUp();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Handle cursor and selection styles when dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  const showLeft = hidePane !== "left";
  const showRight = hidePane !== "right";
  const showDivider = hidePane === "none" && !isMobile;

  // On mobile, render as a simple column layout with internal scrolling
  // The container handles its own scrolling on mobile
  if (isMobile) {
    return (
      <div
        ref={containerRef}
        className="flex flex-col w-full h-full overflow-y-auto"
        data-testid="resizable-split-pane"
      >
        {/* Left Pane - full container height on mobile so children with h-full can resolve */}
        <div
          className={cn("relative flex-shrink-0 h-full", showLeft ? "" : "hidden")}
          data-testid="resizable-split-pane-left"
        >
          {leftPane}
        </div>

        {/* Right Pane - 80% of viewport height on mobile */}
        <div
          className={cn(
            "relative flex-shrink-0",
            showRight ? "h-[80vh]" : "hidden"
          )}
          data-testid="resizable-split-pane-right"
        >
          {rightPane}
        </div>
      </div>
    );
  }

  // Desktop: render as resizable split pane
  return (
    <div
      ref={containerRef}
      className="flex h-full w-full relative"
      data-testid="resizable-split-pane"
    >
      {/* Full-screen overlay when dragging to capture all mouse events */}
      {isDragging &&
        isMounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] cursor-col-resize bg-black/10"
            style={{ userSelect: "none" }}
            data-testid="resizable-split-pane-drag-overlay"
          />,
          document.body
        )}

      {/* Left Pane - always rendered to preserve instance, hidden via CSS */}
      <div
        className={`h-full overflow-auto relative ${showLeft ? "" : "hidden"}`}
        style={{ width: showDivider ? `${leftWidthPercent}%` : "100%" }}
        data-testid="resizable-split-pane-left"
      >
        {leftPane}
      </div>

      {/* Divider - only shown when both panes visible */}
      <div
        className={`w-3 h-full cursor-col-resize flex-shrink-0 flex items-center justify-center transition-colors relative z-10 ${isDragging ? "bg-primary" : "bg-muted hover:bg-accent"
          } ${showDivider ? "" : "hidden"}`}
        onMouseDown={handleMouseDown}
        data-testid="resizable-split-pane-divider"
      >
        {/* Grip dots */}
        <div className="flex flex-col gap-1">
          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
        </div>
      </div>

      {/* Right Pane - always rendered to preserve instance, hidden via CSS */}
      <div
        className={`h-full overflow-auto relative ${showRight ? "flex-1" : "hidden"}`}
        style={{ width: showRight && !showDivider ? "100%" : undefined }}
        data-testid="resizable-split-pane-right"
      >
        {rightPane}
      </div>
    </div>
  );
}
