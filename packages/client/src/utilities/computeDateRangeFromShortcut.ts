"use client";

import type { DateRangeShortcut } from "@zdocs/types";



/**
 * Compute date range from shortcut (relative to current date)
 */
export function computeDateRangeFromShortcut(months: DateRangeShortcut): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const to = now;
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return { from, to };
}

