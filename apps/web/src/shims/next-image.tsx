/** `next/image` → plain <img>. */
import type { ImgHTMLAttributes } from "react";

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | { src: string };
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
}

export default function Image({ src, fill, priority: _p, quality: _q, unoptimized: _u, style, ...rest }: ImageProps) {
  const url = typeof src === "string" ? src : src.src;
  const fillStyle = fill ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" } : {};
  return <img src={url} style={{ ...fillStyle, ...style }} {...rest} />;
}
