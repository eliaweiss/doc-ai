"use client"

import { ReactNode } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        data-testid="context-menu-backdrop"
      />
      <div
        style={{ top: y, left: x }}
        className="fixed bg-card dark:bg-[hsl(0_0%_20%)] border border-border shadow-lg dark:shadow-[0_4px_12px_rgba(255,255,255,0.1)] rounded-md p-2 z-[60]"
        data-testid="context-menu"
      >
        {children}
      </div>
    </>
  );
}

