/**
 * `next-auth` / `next-auth/next` for doc-ai: single local user, always signed in.
 * The user and org rows are created by ensureLocalOrg() (db-schema/queries/local.ts).
 */
import { LOCAL_USER_ID } from "@zdocs/db-schema";

export interface Session {
  user: { id: string; email: string; name: string; isAdmin: boolean };
  expires: string;
}
export type DefaultSession = Session;

export const LOCAL_SESSION: Session = {
  user: { id: LOCAL_USER_ID, email: "local@doc-ai.local", name: "Local user", isAdmin: false },
  expires: "9999-12-31T00:00:00.000Z",
};

export async function getServerSession(..._args: unknown[]): Promise<Session> {
  return LOCAL_SESSION;
}
