"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@zdocs/client-component";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zdocs/client-component";
import { cn } from "../../../lib/utils";

interface EditableFieldProps {
  value: string | Date | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  type?: "text" | "number" | "date";
  displayWidget?: ReactNode;
  "data-testid"?: string;
}

export function EditableField({
  value,
  onChange,
  onBlur,
  className = "",
  inputClassName = "",
  placeholder = "-",
  type = "text",
  displayWidget,
  "data-testid": testId,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const stringValue = value instanceof Date ? value.toISOString() : value ?? "";
  const [editValue, setEditValue] = useState(stringValue);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(stringValue);
  }, [stringValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      } else if (inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleClick = () => {
    if (type === "date") {
      setIsDatePickerOpen(true);
    } else {
      setIsEditing(true);
      setEditValue(stringValue);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== stringValue) {
      onChange(editValue);
    }
    // Call onBlur callback after onChange to trigger autosave
    onBlur?.();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const isTextarea = e.currentTarget instanceof HTMLTextAreaElement;

    if (e.key === "Enter") {
      if (isTextarea && (e.ctrlKey || e.metaKey)) {
        // Ctrl+Enter or Cmd+Enter to save in textarea
        e.preventDefault();
        setIsEditing(false);
        if (editValue !== stringValue) {
          onChange(editValue);
          onBlur?.();
        }
      } else if (!isTextarea) {
        // Enter to save in input
        setIsEditing(false);
        if (editValue !== stringValue) {
          onChange(editValue);
          onBlur?.();
        }
      }
      // In textarea without modifier, Enter creates new line (default behavior)
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(stringValue);
    }
  };

  const parseDate = (dateValue: string | Date | null): Date | undefined => {
    if (!dateValue) return undefined;

    // If already a Date, return it
    if (dateValue instanceof Date) {
      return isValid(dateValue) ? dateValue : undefined;
    }

    if (dateValue === "-") return undefined;

    // Handle ISO date strings (yyyy-MM-dd or with time component) in a timezone-safe way
    // Extract just the date part to avoid UTC conversion issues
    const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1; // months are 0-indexed
      const day = parseInt(isoMatch[3], 10);
      const localDate = new Date(year, month, day);
      if (isValid(localDate)) {
        return localDate;
      }
    }

    // Try to parse other common date formats
    const formats = ["M/d/yyyy", "MM/dd/yyyy", "d/M/yyyy", "dd/MM/yyyy"];

    for (const fmt of formats) {
      const parsed = parse(dateValue, fmt, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    }

    return undefined;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Return ISO date format for backend compatibility
      const isoDate = format(date, "yyyy-MM-dd");
      onChange(isoDate);
      // Trigger autosave after date selection
      onBlur?.();
    }
    setIsDatePickerOpen(false);
  };

  // Date picker mode
  if (type === "date") {
    const selectedDate = parseDate(value);

    return (
      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <PopoverTrigger asChild>
          <span
            onClick={handleClick}
            className={cn(
              "cursor-pointer hover:bg-accent rounded px-1 py-0.5 -mx-1 transition-colors inline-flex items-center gap-1",
              className
            )}
            data-testid={testId}
          >
            {displayWidget ?? (stringValue || placeholder)}
            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Text/Number editing mode
  if (isEditing) {
    if (type === "number" || editValue.length < 50) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`border border-primary rounded px-1 py-0.5 text-foreground outline-none ${inputClassName}`}
          data-testid={testId ? `${testId}-input` : undefined}
          size={
            type === "number"
              ? 10
              : editValue.length < 70
              ? editValue.length
              : 70
          }
        />
      );
    } else {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`border border-primary rounded px-1 py-0.5 text-foreground outline-none resize-none ${inputClassName}`}
          data-testid={testId ? `${testId}-input` : undefined}
          rows={Math.max(2, Math.min(10, editValue.split("\n").length + 1))}
          cols={editValue.length < 70 ? editValue.length : 70}
        />
      );
    }
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer hover:bg-accent rounded px-1 py-0.5 -mx-1 transition-colors ${className}`}
      data-testid={testId}
    >
      {displayWidget ?? (stringValue || placeholder)}
    </span>
  );
}
