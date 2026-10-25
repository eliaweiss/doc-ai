"use client"

import React from "react";
import "./LoadingDots.css"; // Import the CSS file for styling
import { cn } from "../../lib/utils";

const LoadingDots: React.FC<{ className?: string; message?: string }> = ({
  className,
  message,
}) => {
  return (
    <div className="flex flex-col items-center gap-2"
      data-testid="loading-dots"
    >
      <div className={cn("loading-dots", className)}>
        {[0, 1, 2].map((index) => (
          <svg
            key={index}
            className="dot"
            width="6"
            height="6"
            viewBox="0 0 6 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="3" cy="3" r="3" fill="currentColor" />
          </svg>
        ))}
      </div>
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  );
};

export { LoadingDots };
