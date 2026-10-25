/** Types only: `import { Session, DefaultSession } from "next-auth"`. */
export interface DefaultSession {
  user?: { id?: string; name?: string | null; email?: string | null; image?: string | null; isAdmin?: boolean };
  expires: string;
}
export type Session = DefaultSession;
