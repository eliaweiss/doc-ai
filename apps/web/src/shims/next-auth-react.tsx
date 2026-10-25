/**
 * `next-auth/react` for doc-ai: one local user who is always signed in.
 * Matches the session the server-side shim returns (apps/server/src/next-compat/next-auth.ts).
 */
import type { ReactNode } from "react";

const session = {
  user: { id: "local-user", email: "local@doc-ai.local", name: "Local user", image: null, isAdmin: false },
  expires: "9999-12-31T00:00:00.000Z",
};

const value = { data: session, status: "authenticated" as const, update: async () => session };

export function useSession() {
  return value;
}

export async function getSession() {
  return session;
}

export async function signIn(..._args: unknown[]) {
  return { ok: true, error: null, status: 200, url: null };
}

export async function signOut(..._args: unknown[]) {}

export function SessionProvider({ children }: { children: ReactNode; session?: unknown }) {
  return <>{children}</>;
}
