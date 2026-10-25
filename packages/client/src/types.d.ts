import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      isAdmin: boolean;
      roles: string[];
    } & DefaultSession["user"];
  }
}
