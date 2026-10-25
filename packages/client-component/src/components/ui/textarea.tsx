"use client"

import * as React from "react"

import { cn } from "../../lib/utils"
import { getDirectionFromText } from "@zdocs/util";
import { useEffect, useState } from "react";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onChange, placeholder = "", ...props }, ref) => {
  const [dir, setDir] = useState<"ltr" | "rtl">(() =>
    getDirectionFromText(placeholder)
  );

  useEffect(() => {
    const value = props.value as string;
    if (value || placeholder) {
      const dir = value
        ? getDirectionFromText(value)
        : getDirectionFromText(placeholder);
      setDir(dir);
    }
  }, [placeholder, props.value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDir(
      value ? getDirectionFromText(value) : getDirectionFromText(placeholder)
    );

    // Call the original onChange if provided
    onChange?.(e);
  };
  
  return (
    <textarea
      dir={dir}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-white dark:bg-black",
        " px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none",
        " focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        " md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
