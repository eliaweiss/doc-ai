"use client"

import * as React from "react"

import { cn } from "../../lib/utils"
import { getDirectionFromText } from "@zdocs/util";
import { useEffect, useState } from "react";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, placeholder = "", onChange, ...props }, ref) => {

    const [dir, setDir] = useState<"ltr" | "rtl">(() =>
      getDirectionFromText(placeholder)
    );

    useEffect(() => {
      const value = props.value as string;
      if (value) {
        const dir = value
          ? getDirectionFromText(value)
          : getDirectionFromText(placeholder);
        setDir(dir);
      }
    }, [placeholder, props.value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setDir(
        value ? getDirectionFromText(value) : getDirectionFromText(placeholder)
      );

      // Call the original onChange if provided
      onChange?.(e);
    };

    return (
      <input
        type={type}
        dir={dir}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "flex h-9 w-full rounded-md border border-input  bg-white dark:bg-black",
          " px-3 py-1 text-base shadow-sm transition-colors",
          " file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          " placeholder:text-muted-foreground",
          " focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          " disabled:cursor-not-allowed disabled:opacity-50",
          " md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
