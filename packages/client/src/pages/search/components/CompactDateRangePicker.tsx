"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@zdocs/client-component";
import { Calendar } from "@zdocs/client-component";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zdocs/client-component";
import { cn } from "../../../lib/utils";
import { useMobileScreen } from "../../../hooks/useMobileScreen";
import type { DateRangeShortcut } from "@zdocs/types";
import { computeDateRangeFromShortcut } from "../../../utilities/computeDateRangeFromShortcut";

interface CompactDateRangePickerProps {
  dateFrom: Date | null;
  dateTo: Date | null;
  onDateRangeChange: (from: Date | null, to: Date | null) => void;
  selectedQuickRange: DateRangeShortcut | null;
  onQuickRangeChange: (range: DateRangeShortcut | null) => void;
  disabled?: boolean;
  /** Optional callback triggered when a quick range shortcut is selected */
  onQuickRangeSelect?: () => void;
}

export function CompactDateRangePicker({
  dateFrom,
  dateTo,
  onDateRangeChange,
  selectedQuickRange,
  onQuickRangeChange,
  disabled = false,
  onQuickRangeSelect,
}: CompactDateRangePickerProps) {
  const t = useTranslations("search");
  const isMobile = useMobileScreen();

  const formatDateDisplay = (date: Date | null, short = false): string => {
    if (!date) return "?";
    if (short) {
      return format(date, "MMM d");
    }
    return format(date, "MMM d, yyyy");
  };

  const displayText =
    !dateFrom && !dateTo
      ? t("dateNotSet")
      : isMobile
        ? `${formatDateDisplay(dateFrom, true)} - ${formatDateDisplay(dateTo, true)}`
        : `${formatDateDisplay(dateFrom)} - ${formatDateDisplay(dateTo)}`;

  const handleQuickRange = (months: DateRangeShortcut) => {
    onQuickRangeChange(months);
    const { from, to } = computeDateRangeFromShortcut(months);
    onDateRangeChange(from, to);
    // Trigger optional callback after state updates
    if (onQuickRangeSelect) {
      setTimeout(() => onQuickRangeSelect(), 0);
    }
  };

  const handleFromChange = (date: Date | undefined) => {
    onQuickRangeChange(null);
    onDateRangeChange(date || null, dateTo);
  };

  const handleToChange = (date: Date | undefined) => {
    onQuickRangeChange(null);
    onDateRangeChange(dateFrom, date || null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "gap-2 font-normal",
            isMobile ? "h-11 w-full justify-between" : "h-10",
            !dateFrom && !dateTo && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          <span className="max-w-[180px] truncate">{displayText}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-4",
          isMobile
            ? "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto"
            : "w-auto"
        )}
        align="start"
        side={isMobile ? "bottom" : undefined}
        sideOffset={isMobile ? 8 : 4}
        style={
          isMobile
            ? {
              maxHeight: "calc(100dvh - 20rem)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }
            : undefined
        }
      >
        <div className={cn("flex flex-col gap-4 min-w-0", isMobile && "pb-4")}>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
            {[3, 6, 12].map((months) => (
              <Button
                key={months}
                variant={selectedQuickRange === months ? "outline" : "ghost"}
                size="sm"
                onClick={() => handleQuickRange(months as DateRangeShortcut)}
                className="text-xs flex-1 h-7"
              >
                {t(`dateRange${months === 12 ? "1y" : months + "m"}`)}
              </Button>
            ))}
          </div>

          <div
            className={cn(
              "gap-4",
              isMobile ? "flex flex-col" : "flex"
            )}
          >
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground px-1">
                {t("dateFrom")}
              </span>
              <Calendar
                mode="single"
                selected={dateFrom || undefined}
                onSelect={handleFromChange}
                disabled={(date) => (dateTo ? date > dateTo : false)}
                initialFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground px-1">
                {t("dateTo")}
              </span>
              <Calendar
                mode="single"
                selected={dateTo || undefined}
                onSelect={handleToChange}
                disabled={(date) => (dateFrom ? date < dateFrom : false)}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
