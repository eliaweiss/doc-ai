/** `next/link` → react-router Link (external and absolute URLs fall back to <a>). */
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { Link as RouterLink } from "react-router-dom";

type Href = string | { pathname?: string; query?: Record<string, string> };

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: Href;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

function toPath(href: Href): string {
  if (typeof href === "string") return href;
  const qs = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname ?? ""}${qs}`;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _prefetch, scroll: _scroll, replace, ...rest },
  ref
) {
  const to = toPath(href);
  if (/^[a-z]+:/i.test(to) || rest.target === "_blank") {
    return <a ref={ref} href={to} {...rest} />;
  }
  return <RouterLink ref={ref} to={to} replace={replace} {...rest} />;
});

export default Link;
