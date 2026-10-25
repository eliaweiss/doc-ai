/**
 * `next/navigation` on top of react-router, for the copied zdocs client.
 */
import { useMemo } from "react";
import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from "react-router-dom";

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      // Next re-runs server components; client data is refetched by the pages themselves
      refresh: () => {},
      prefetch: (_href: string) => {},
    }),
    [navigate]
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  return useRouterSearchParams()[0];
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useRouterParams() as T;
}

export function redirect(href: string): never {
  window.location.replace(href);
  throw new Error(`redirect to ${href}`);
}

export function notFound(): never {
  throw new Error("Not found");
}
