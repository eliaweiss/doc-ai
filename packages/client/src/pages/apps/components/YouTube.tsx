"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { cn } from "@zdocs/client-component";

type YouTubeSize = "sm" | "md" | "lg";

const playButtonSizeClasses: Record<
  YouTubeSize,
  { button: string; icon: string }
> = {
  sm: {
    button: "h-10 w-16 rounded-xl",
    icon: "h-5 w-5",
  },
  md: {
    button: "h-12 w-20 rounded-2xl",
    icon: "h-7 w-7",
  },
  lg: {
    button: "h-16 w-[90px] rounded-2xl",
    icon: "h-8 w-8",
  },
};

function extractVideoId(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1);
    }
    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com"
    ) {
      return url.searchParams.get("v");
    }
  } catch {
    // Not a URL - treat the value as a bare video ID
  }
  if (/^[\w-]{11}$/.test(src)) {
    return src;
  }
  return null;
}

interface YouTubeProps {
  src: string;
  className?: string;
  title?: string;
  thumbnail?: string;
  dataTestid?: string;
  onPlay?: () => void;
  size?: YouTubeSize;
}

export function YouTube({
  src,
  className,
  title,
  thumbnail,
  dataTestid = "youtube-player",
  onPlay,
  size = "lg",
}: YouTubeProps) {
  const [hasStarted, setHasStarted] = React.useState(false);

  const videoId = extractVideoId(src);
  const playButtonClasses = playButtonSizeClasses[size];

  const autoThumbnail =
    thumbnail ||
    (videoId
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : undefined);

  const handlePlayClick = () => {
    setHasStarted(true);
    onPlay?.();
  };

  if (!videoId) {
    return (
      <div className="text-destructive p-4" data-testid={dataTestid}>
        Invalid YouTube URL or video ID: {src}
      </div>
    );
  }

  return (
    <div
      className={cn("relative aspect-video overflow-hidden rounded-lg shadow-lg", className)}
      data-testid={dataTestid}
    >
      {!hasStarted ? (
        <>
          {autoThumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={autoThumbnail}
              alt={title ? `${title} thumbnail` : "YouTube video thumbnail"}
              className="absolute inset-0 h-full w-full object-contain bg-black"
              data-testid={`${dataTestid}-thumbnail`}
            />
          )}
          <button
            type="button"
            onClick={handlePlayClick}
            className="absolute inset-0 z-10 flex items-center justify-center transition hover:bg-black/10"
            aria-label={title ? `Play ${title}` : "Play video"}
            data-testid={`${dataTestid}-play-button`}
          >
            <span
              className={cn(
                "flex items-center justify-center bg-red-600/95 shadow-2xl transition hover:scale-105",
                playButtonClasses.button
              )}
            >
              <Play
                className={cn(
                  "ml-1 fill-white text-white",
                  playButtonClasses.icon
                )}
              />
            </span>
          </button>
        </>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title || "YouTube video"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          data-testid={`${dataTestid}-iframe`}
        />
      )}
    </div>
  );
}
