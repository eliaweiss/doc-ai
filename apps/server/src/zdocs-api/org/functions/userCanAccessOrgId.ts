import { Session } from "next-auth";
import { Organization } from "@zdocs/types";
import { getOrganizationById } from "@zdocs/db-schema";

export function userCanAccessOrg(org: Organization, session: Session) {
  if (session?.user?.id === org.ownerUserId) {
    return true;
  }
  return org.sharedWithEmails?.includes(session?.user?.email as string);
}

export async function userCanAccessOrgId(orgId: string, session: Session) {
  const org = await getOrganizationById(orgId);
  if (!org) {
    return false;
  }
  return userCanAccessOrg(org, session);
}
