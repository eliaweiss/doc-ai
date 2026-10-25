"use client";

import { cn } from "../../lib/utils";

type DocVisionLogoProps = {
    className?: string;
    size?: number;
    backgroundColor?: string;
    "data-testid"?: string;
};

export function DocVisionLogo({
    className,
    size = 24,
    backgroundColor,
    "data-testid": testId = "doc-vision-logo",
}: DocVisionLogoProps) {
    return (
        <div
            className={cn("p-2 rounded-lg flex items-center justify-center", className)}
            data-testid={testId}
        >
            {/* Light theme logo (black) - hidden in dark mode */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/logo/doc-vision-logo-black.svg"
                alt="Doc Vision Logo"
                className={cn("dark:hidden", className)}
                style={{ height: size, width: "auto" }}
            />
            {/* Dark theme logo (white) - hidden in light mode */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/logo/doc-vision-logo-white.svg"
                alt="Doc Vision Logo"
                className={cn("hidden dark:block", className)}
                style={{ height: size, width: "auto" }}
            />
        </div>
    );
}
