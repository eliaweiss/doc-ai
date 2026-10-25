import { zdocsDb } from "../db";
import { organizationsTbl } from "../schemas/organizations";
import { eq, and, or, isNull, sql, InferSelectModel, asc, desc } from "drizzle-orm";
import type { Organization } from "@zdocs/types";
import { nanoid, slugify } from "@zdocs/util";
import { seedDocumentTypesForOrg } from "./document-types";
import { seedDefaultQuickAccess } from "./quick-access";


// Define Organization type based on your schema
export type OrganizationModel = InferSelectModel<typeof organizationsTbl>;

export async function getOrganizationById(
  id: string
): Promise<Organization | null> {

  const result = await zdocsDb
    .select()
    .from(organizationsTbl)
    .where(and(eq(organizationsTbl.id, id), isNull(organizationsTbl.deletedAt)))
    .limit(1)
    .execute();

  return (result[0] as Organization | undefined) || null;
}

/**
 * Create a new organization
 * Also seeds default document types and owner quick access for the org
 */
export async function createOrganization(params: {
  name: string;
  ownerUserId: string;
  description?: string | null;
  baseCurrency?: string;
  selectedSchemas?: string[];
}): Promise<Organization> {

  const [organization] = await zdocsDb
    .insert(organizationsTbl)
    .values({
      name: params.name,
      ownerUserId: params.ownerUserId,
      description: params.description || null,
      baseCurrency: params.baseCurrency || "USD",
    })
    .returning();

  // // Create default folders for selected schemas
  // const { folderMap } = await createDefaultFolders(
  //   organization.id,
  //   params.selectedSchemas
  // );

  // Seed document types for new org with links to folders
  await seedDocumentTypesForOrg(
    organization.id,
    params.selectedSchemas
    // folderMap
  );

  await seedDefaultQuickAccess(organization.id, params.ownerUserId);

  // Note: Initial credits should be granted by the caller (API route)
  // using grantInitialCredits() from @zdocs/srv to avoid circular dependency

  return organization as Organization;
}

/**
 * Update an organization's details
 */
export async function updateOrganization(
  orgId: string,
  data: {
    name?: string;
    description?: string | null;
    baseCurrency?: string;
    timezone?: string;
    sharedWithEmails?: string[];
    webhookSecret?: string | null;
    webhookCallbackUrl?: string | null;
    webhookSigningSecret?: string | null;
    emailForwardAddress?: string | null;
    emailForwardEnabled?: boolean;
    emailNotifyOnUpload?: boolean;
    color?: string | null;
  }
): Promise<Organization | null> {

  const [organization] = await zdocsDb
    .update(organizationsTbl)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.baseCurrency !== undefined && {
        baseCurrency: data.baseCurrency,
      }),
      ...(data.timezone !== undefined && {
        timezone: data.timezone,
      }),
      ...(data.sharedWithEmails !== undefined && {
        sharedWithEmails: data.sharedWithEmails,
      }),
      ...(data.webhookSecret !== undefined && {
        webhookSecret: data.webhookSecret,
      }),
      ...(data.webhookCallbackUrl !== undefined && {
        webhookCallbackUrl: data.webhookCallbackUrl,
      }),
      ...(data.webhookSigningSecret !== undefined && {
        webhookSigningSecret: data.webhookSigningSecret,
      }),
      ...(data.emailForwardAddress !== undefined && {
        emailForwardAddress: data.emailForwardAddress,
      }),
      ...(data.emailForwardEnabled !== undefined && {
        emailForwardEnabled: data.emailForwardEnabled,
      }),
      ...(data.emailNotifyOnUpload !== undefined && {
        emailNotifyOnUpload: data.emailNotifyOnUpload,
      }),
      ...(data.color !== undefined && { color: data.color }),
      updatedAt: new Date(),
    })
    .where(eq(organizationsTbl.id, orgId))
    .returning();

  return (organization as Organization) || null;
}

/**
 * Get organization by webhook ID
 */
export async function getOrganizationByWebhookId(
  webhookId: string
): Promise<Organization | null> {

  const result = await zdocsDb
    .select()
    .from(organizationsTbl)
    .where(
      and(
        eq(organizationsTbl.webhookId, webhookId),
        isNull(organizationsTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  return (result[0] as Organization | undefined) || null;
}

/**
 * Get organization by email ID
 */
export async function getOrganizationByEmailId(
  emailId: string
): Promise<Organization | null> {

  const result = await zdocsDb
    .select()
    .from(organizationsTbl)
    .where(
      and(
        eq(organizationsTbl.emailId, emailId),
        isNull(organizationsTbl.deletedAt)
      )
    )
    .limit(1)
    .execute();

  return (result[0] as Organization | undefined) || null;
}

/**
 * Get or create webhook ID for an organization
 */
export async function getOrCreateWebhookId(orgId: string): Promise<string> {

  const org = await getOrganizationById(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }

  // If webhookId already exists, return it
  if (org.webhookId) {
    return org.webhookId;
  }

  // Generate new webhookId using nanoid
  const webhookId = nanoid();

  // Update organization with new webhookId
  const [updated] = await zdocsDb
    .update(organizationsTbl)
    .set({
      webhookId,
      updatedAt: new Date(),
    })
    .where(eq(organizationsTbl.id, orgId))
    .returning();

  return (updated as Organization).webhookId!;
}

/**
 * Get or create email ID for an organization
 */
export async function getOrCreateEmailId(orgId: string): Promise<string> {

  const org = await getOrganizationById(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }

  // If emailId already exists, return it
  if (org.emailId) {
    return org.emailId;
  }

  // Generate new emailId using slugified org name + 4 random digits
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const emailId = `${slugify(org.name)}-${randomDigits}`;

  // Update organization with new emailId
  const [updated] = await zdocsDb
    .update(organizationsTbl)
    .set({
      emailId,
      updatedAt: new Date(),
    })
    .where(eq(organizationsTbl.id, orgId))
    .returning();

  return (updated as Organization).emailId!;
}

/**
 * Get all organizations that a user has access to
 * (either as owner or via sharedWithEmails)
 * Excludes soft-deleted organizations
 */
export async function getOrganizationsForUser(
  userId: string,
  userEmail?: string | null
): Promise<Organization[]> {

  const organizations = await zdocsDb
    .select()
    .from(organizationsTbl)
    .where(
      and(
        isNull(organizationsTbl.deletedAt),
        or(
          eq(organizationsTbl.ownerUserId, userId),
          userEmail
            ? sql`${organizationsTbl.sharedWithEmails} @> ARRAY[${userEmail}]::text[]`
            : undefined
        )
      )
    )
    .orderBy(asc(organizationsTbl.createdAt));

  return organizations as Organization[];
}

/**
 * Soft delete an organization
 */
export async function deleteOrganization(orgId: string): Promise<boolean> {

  const result = await zdocsDb
    .update(organizationsTbl)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(organizationsTbl.id, orgId), isNull(organizationsTbl.deletedAt))
    )
    .returning({ id: organizationsTbl.id });

  return result.length > 0;
}

/**
 * Get all organizations (admin only)
 * Excludes soft-deleted organizations
 */
export async function getAllOrganizations(): Promise<Organization[]> {

  const organizations = await zdocsDb
    .select()
    .from(organizationsTbl)
    .where(isNull(organizationsTbl.deletedAt))
    .orderBy(desc(organizationsTbl.createdAt));

  return organizations as Organization[];
}
