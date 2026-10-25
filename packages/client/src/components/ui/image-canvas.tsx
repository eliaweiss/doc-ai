"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";
import { Button } from "@zdocs/client-component";

interface ImageCanvasProps {
  src: string;
  alt?: string;
  showToolbar?: boolean;
  showRotate?: boolean;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onRotate?: () => void;
  onFitToWidth?: () => void;
  documentId?: string;
}

interface ImageCanvasToolbarProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate?: () => void;
  onFitToWidth: () => void;
  showRotate?: boolean;
}

export function ImageCanvasToolbar({
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onRotate,
  onFitToWidth,
  showRotate = true,
}: ImageCanvasToolbarProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex items-center gap-2" data-testid="image-canvas-toolbar">
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        data-testid="zoom-out-btn"
      >
        <ZoomOut className="w-4 h-4" />
      </Button>
      <span className="text-sm text-muted-foreground min-w-[50px] text-center">
        {zoomPercent}%
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        data-testid="zoom-in-btn"
      >
        <ZoomIn className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onFitToWidth}
        data-testid="fit-to-width-btn"
        title="Fit to width"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
      {showRotate && onRotate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRotate}
          data-testid="rotate-btn"
        >
          <RotateCw className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

// Rotate an image using an off-screen canvas
function rotateImage(img: HTMLImageElement, rotation: number): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  const { naturalWidth: w, naturalHeight: h } = img;

  // Set canvas size based on rotation
  if (rotation === 90 || rotation === 270) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }

  // Move to center, rotate, then draw
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);

  return canvas.toDataURL();
}

export function ImageCanvas({
  src,
  alt = "Image",
  showToolbar = true,
  showRotate = true,
  minZoom = 0.25,
  maxZoom = 5,
  zoomStep = 0.25,
  className = "",
  onLoad,
  onError,
  onZoomIn: externalOnZoomIn,
  onZoomOut: externalOnZoomOut,
  onRotate: externalOnRotate,
  onFitToWidth: externalOnFitToWidth,
  documentId,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayImageRef = useRef<HTMLImageElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const initialZoomRef = useRef<number>(1);
  const zoomRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotationRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  const [displaySrc, setDisplaySrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(true);
  const [, forceUpdate] = useState({});

  // Load the original image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      originalImageRef.current = img;
      setDisplaySrc(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      setIsLoading(false);
      onError?.();
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onError]);

  const applyTransform = useCallback(() => {
    if (displayImageRef.current) {
      displayImageRef.current.style.transform = `translate(${positionRef.current.x}px, ${positionRef.current.y}px) scale(${zoomRef.current})`;
      displayImageRef.current.style.transition = isDraggingRef.current
        ? "none"
        : "transform 0.1s ease-out";
    }
  }, []);

  const calculateFitToWidthZoom = useCallback(() => {
    if (!containerRef.current || !displayImageRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth;
    const imageWidth = displayImageRef.current.naturalWidth;

    if (imageWidth === 0) return 1;

    // Add some padding (16px on each side)
    const padding = 32;
    const availableWidth = containerWidth - padding;

    return availableWidth / imageWidth;
  }, []);

  const fitToWidth = useCallback(() => {
    const fitZoom = calculateFitToWidthZoom();
    initialZoomRef.current = fitZoom;
    zoomRef.current = fitZoom;
    positionRef.current = { x: 0, y: 0 };
    applyTransform();
    forceUpdate({});
  }, [applyTransform, calculateFitToWidthZoom]);

  // Get the relative zoom (where 1 = fit to width = 100%)
  const getRelativeZoom = useCallback(() => {
    if (initialZoomRef.current === 0) return 1;
    return zoomRef.current / initialZoomRef.current;
  }, []);

  // Convert relative zoom to actual scale
  const relativeToActualZoom = useCallback((relativeZoom: number) => {
    return relativeZoom * initialZoomRef.current;
  }, []);

  const handleZoomIn = useCallback(() => {
    const maxActualZoom = relativeToActualZoom(maxZoom);
    const stepActual = zoomStep * initialZoomRef.current;
    zoomRef.current = Math.min(maxActualZoom, zoomRef.current + stepActual);
    applyTransform();
    forceUpdate({});
    externalOnZoomIn?.();
  }, [applyTransform, maxZoom, zoomStep, relativeToActualZoom, externalOnZoomIn]);

  const handleZoomOut = useCallback(() => {
    const minActualZoom = relativeToActualZoom(minZoom);
    const stepActual = zoomStep * initialZoomRef.current;
    zoomRef.current = Math.max(minActualZoom, zoomRef.current - stepActual);
    applyTransform();
    forceUpdate({});
    externalOnZoomOut?.();
  }, [applyTransform, minZoom, zoomStep, relativeToActualZoom, externalOnZoomOut]);

  const handleRotate = useCallback(() => {
    if (!originalImageRef.current) return;

    // Update rotation
    rotationRef.current = (rotationRef.current + 90) % 360;

    // Create rotated image
    const rotatedSrc = rotateImage(
      originalImageRef.current,
      rotationRef.current
    );
    setDisplaySrc(rotatedSrc);
    externalOnRotate?.();
  }, [externalOnRotate]);

  const handleFitToWidth = useCallback(() => {
    fitToWidth();
    externalOnFitToWidth?.();
  }, [fitToWidth, externalOnFitToWidth]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      const minActualZoom = relativeToActualZoom(minZoom);
      const maxActualZoom = relativeToActualZoom(maxZoom);
      const wheelStep = 0.1 * initialZoomRef.current;
      zoomRef.current =
        delta > 0
          ? Math.max(minActualZoom, zoomRef.current - wheelStep)
          : Math.min(maxActualZoom, zoomRef.current + wheelStep);
      applyTransform();
      forceUpdate({});
    },
    [applyTransform, minZoom, maxZoom, relativeToActualZoom]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      isDraggingRef.current = true;
      const startX = e.clientX - positionRef.current.x;
      const startY = e.clientY - positionRef.current.y;

      const handleMouseMove = (e: MouseEvent) => {
        positionRef.current = {
          x: e.clientX - startX,
          y: e.clientY - startY,
        };
        applyTransform();
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        applyTransform();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [applyTransform]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  const handleDisplayImageLoad = useCallback(() => {
    fitToWidth();
    onLoad?.();
  }, [fitToWidth, onLoad]);

  return (
    <div
      className={`flex flex-col ${className}`}
      data-testid="image-canvas-container"
    >
      {showToolbar && (
        <div
          className="flex items-center justify-end px-4 py-2 border-b border-border bg-card"
          data-testid="image-canvas-toolbar-wrapper"
        >
          <ImageCanvasToolbar
            zoom={getRelativeZoom()}
            minZoom={minZoom}
            maxZoom={maxZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onRotate={showRotate ? handleRotate : undefined}
            onFitToWidth={handleFitToWidth}
            showRotate={showRotate}
          />
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-start justify-center cursor-grab active:cursor-grabbing pt-4"
        style={{
          background:
            "repeating-linear-gradient(var(--muted), var(--muted) 19px, var(--border) 19px, var(--border) 20px), repeating-linear-gradient(90deg, var(--muted), var(--muted) 19px, var(--border) 19px, var(--border) 20px)",
        }}
        onMouseDown={handleMouseDown}
        data-testid="image-canvas"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : (
          <img
            ref={displayImageRef}
            src={displaySrc}
            alt={alt}
            className="max-w-none rounded-lg shadow-lg select-none"
            style={{
              transformOrigin: "center top",
            }}
            draggable={false}
            onLoad={handleDisplayImageLoad}
            onError={onError}
            data-testid="image-canvas-image"
          />
        )}
      </div>
    </div>
  );
}
