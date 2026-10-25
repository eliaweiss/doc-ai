/**
 * Notification queries.
 *
 * All functions REQUIRE orgId - enforced at compile time.
 * This ensures multi-tenant isolation for notifications.
 *
 * @module notification-queries
 */

import { zdocsDb } from "../db";
import { notificationsTbl } from "../schemas/notifications";
import { documentDataTbl } from "../schemas/documents";
import { eq, and, inArray, sql } from "drizzle-orm";
import type {
  NotificationRecord,
  NotificationStatus,
  NotificationLevel,
  NotificationType,
  DocumentNotification,
} from "@zdocs/types";

// Check if we're running in Edge Runtime
const isEdgeRuntime =
  typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge";

/**
 * Create notifications for a document or org-scoped.
 * Only warning/error notifications should be inserted (info stays in document_data only).
 *
 * @param orgId - Organization ID
 * @param documentId - Document ID (optional, null for org-scoped notifications)
 * @param notificationType - Type of notification (DOCUMENT or TASK)
 * @param notifications - Array of notifications to create (should be warning/error only)
 * @param metadata - Optional metadata for linking (e.g., taskId for TASK notifications)
 * @returns Created notification records with IDs
 */
export async function createNotificationsForOrg(
  orgId: string,
  documentId: string | null,
  notificationType: NotificationType,
  notifications: Array<{
    level: NotificationLevel;
    message: string;
    fieldPath?: string | null;
    formulaField?: string | null;
  }>,
  metadata?: Record<string, unknown> | null
): Promise<NotificationRecord[]> {
  if (isEdgeRuntime || notifications.length === 0) {
    return [];
  }

  const values = notifications.map((n) => ({
    orgId,
    documentId,
    notificationType,
    metadata: metadata || null,
    level: n.level,
    message: n.message,
    fieldPath: n.fieldPath || null,
    formulaField: n.formulaField || null,
    status: "NEW" as NotificationStatus,
  }));

  const inserted = await zdocsDb
    .insert(notificationsTbl)
    .values(values)
    .returning();

  return inserted as NotificationRecord[];
}

/**
 * Create a single task-scoped notification.
 * Used by scheduled tasks to create org-scoped notifications.
 *
 * @param orgId - Organization ID
 * @param notification - Notification details
 * @returns Created notification record with ID
 */
export async function createTaskNotification(
  orgId: string,
  notification: {
    level: NotificationLevel;
    message: string;
    metadata?: Record<string, unknown>;
  }
): Promise<NotificationRecord> {
  if (isEdgeRuntime) {
    throw new Error("Cannot create notifications in Edge Runtime");
  }

  const [inserted] = await zdocsDb
    .insert(notificationsTbl)
    .values({
      orgId,
      documentId: null,
      notificationType: "TASK",
      metadata: notification.metadata || null,
      level: notification.level,
      message: notification.message,
      fieldPath: null,
      formulaField: null,
      status: "NEW" as NotificationStatus,
    })
    .returning();

  return inserted as NotificationRecord;
}

/**
 * Get all notifications for a document.
 * Only returns document-scoped notifications.
 *
 * @param orgId - Organization ID
 * @param documentId - Document ID
 * @returns All notifications for the document
 */
export async function getNotificationsForDocument(
  orgId: string,
  documentId: string
): Promise<NotificationRecord[]> {
  if (isEdgeRuntime) return [];

  const result = await zdocsDb
    .select()
    .from(notificationsTbl)
    .where(
      and(
        eq(notificationsTbl.orgId, orgId),
        eq(notificationsTbl.documentId, documentId),
        eq(notificationsTbl.notificationType, "DOCUMENT")
      )
    )
    .execute();

  return result as NotificationRecord[];
}

/**
 * Get active notifications (NEW or PENDING) for an organization.
 *
 * @param orgId - Organization ID
 * @returns Active notifications for the organization
 */
export async function getActiveNotificationsForOrg(
  orgId: string
): Promise<NotificationRecord[]> {
  if (isEdgeRuntime) return [];

  const result = await zdocsDb
    .select()
    .from(notificationsTbl)
    .where(
      and(
        eq(notificationsTbl.orgId, orgId),
        inArray(notificationsTbl.status, ["NEW", "PENDING"])
      )
    )
    .execute();

  return result as NotificationRecord[];
}

/**
 * Update notification status.
 *
 * @param orgId - Organization ID
 * @param notificationId - Notification ID
 * @param status - New status
 * @returns Updated notification or null if not found
 */
export async function updateNotificationStatus(
  orgId: string,
  notificationId: string,
  status: NotificationStatus
): Promise<NotificationRecord | null> {
  if (isEdgeRuntime) return null;

  const [updated] = await zdocsDb
    .update(notificationsTbl)
    .set({ status })
    .where(
      and(
        eq(notificationsTbl.id, notificationId),
        eq(notificationsTbl.orgId, orgId)
      )
    )
    .returning();

  // If status is RESOLVED or IGNORED, remove notification from document_data.notifications
  // Only for document-scoped notifications
  if (
    updated &&
    (status === "RESOLVED" || status === "IGNORED") &&
    updated.documentId
  ) {
    await removeNotificationFromDocument(
      orgId,
      updated.documentId,
      notificationId
    );
  }

  return (updated as NotificationRecord | undefined) || null;
}

/**
 * Remove a notification from document_data.notifications JSONB array.
 * Called when notification is resolved or ignored.
 * Only works for document-scoped notifications.
 *
 * @param orgId - Organization ID
 * @param documentId - Document ID (must not be null)
 * @param notificationId - Notification ID to remove
 */
export async function removeNotificationFromDocument(
  orgId: string,
  documentId: string | null,
  notificationId: string
): Promise<void> {
  if (isEdgeRuntime || !documentId) return;

  // Use PostgreSQL jsonb_set to filter out the notification with matching id
  // This removes the notification object with the matching id from the array
  await zdocsDb
    .update(documentDataTbl)
    .set({
      notifications: sql`(
        SELECT COALESCE(
          jsonb_agg(elem)
          FILTER (WHERE elem->>'id' != ${notificationId}),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(COALESCE(${documentDataTbl.notifications}, '[]'::jsonb)) AS elem
      )`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentDataTbl.documentId, documentId),
        eq(documentDataTbl.orgId, orgId)
      )
    );
}

/**
 * Delete all notifications for a document.
 * Used when re-extracting a document (old notifications are replaced).
 * Only deletes document-scoped notifications.
 *
 * @param orgId - Organization ID
 * @param documentId - Document ID
 */
export async function deleteNotificationsForDocument(
  orgId: string,
  documentId: string
): Promise<void> {
  if (isEdgeRuntime) return;

  await zdocsDb
    .delete(notificationsTbl)
    .where(
      and(
        eq(notificationsTbl.orgId, orgId),
        eq(notificationsTbl.documentId, documentId),
        eq(notificationsTbl.notificationType, "DOCUMENT")
      )
    );
}

/**
 * Convert FormulaNotification array to DocumentNotification array,
 * persisting warning/error notifications to the database.
 *
 * - info: Stored in document_data only (no ID)
 * - warning/error: Inserted to notifications table, ID added
 *
 * @param orgId - Organization ID
 * @param documentId - Document ID
 * @param formulaNotifications - Notifications from formula evaluation
 * @returns DocumentNotification array ready to store in document_data
 */
export async function processAndSaveNotifications(
  orgId: string,
  documentId: string,
  formulaNotifications: Array<{
    level: "info" | "warning" | "error";
    message: string;
    fieldPath?: string;
    formulaField?: string;
  }>
): Promise<DocumentNotification[]> {
  if (isEdgeRuntime || formulaNotifications.length === 0) {
    return [];
  }

  // Delete existing notifications for this document (re-extraction replaces them)
  await deleteNotificationsForDocument(orgId, documentId);

  // Separate info from warning/error
  const infoNotifications = formulaNotifications.filter((n) => n.level === "info");
  const persistNotifications = formulaNotifications.filter(
    (n) => n.level === "warning" || n.level === "error"
  );

  // Insert warning/error to database (document-scoped)
  const inserted = await createNotificationsForOrg(
    orgId,
    documentId,
    "DOCUMENT",
    persistNotifications,
    null // No metadata for document notifications
  );

  // Build result array
  const result: DocumentNotification[] = [];

  // Add info notifications (no ID)
  for (const n of infoNotifications) {
    result.push({
      level: n.level,
      message: n.message,
      fieldPath: n.fieldPath,
      formulaField: n.formulaField,
    });
  }

  // Add warning/error notifications (with ID)
  for (const record of inserted) {
    result.push({
      id: record.id,
      level: record.level,
      message: record.message,
      fieldPath: record.fieldPath || undefined,
      formulaField: record.formulaField || undefined,
    });
  }

  return result;
}

