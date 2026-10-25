/**
 * Notification Service
 *
 * Handles saving formula notifications to the database.
 * - info: Stored only in document_data.notifications
 * - warning/error: Inserted to notifications table, ID added to document_data
 *
 * @module notification-service
 */

import {
  processAndSaveNotifications,
  deleteNotificationsForDocument,
  createTaskNotification,
} from "@zdocs/db-schema";
import type { FormulaNotification } from "./formula-service";
import type {
  DocumentNotification,
  NotificationRecord,
  NotificationLevel,
} from "@zdocs/types";

/**
 * Save formula notifications to the database.
 *
 * For info-level notifications: stored in document_data only (no ID).
 * For warning/error: inserted to notifications table with status=NEW, ID returned.
 *
 * @param orgId - Organization ID
 * @param documentId - Document ID
 * @param formulaNotifications - Notifications from formula evaluation
 * @returns DocumentNotification array ready to store in document_data
 */
export async function saveNotifications(
  orgId: string,
  documentId: string,
  formulaNotifications: FormulaNotification[]
): Promise<DocumentNotification[]> {
  if (formulaNotifications.length === 0) {
    // Delete any existing notifications for this document (re-extraction clears old ones)
    await deleteNotificationsForDocument(orgId, documentId);
    return [];
  }

  // Convert FormulaNotification to the shape expected by processAndSaveNotifications
  const notificationsToProcess = formulaNotifications.map((n) => ({
    level: n.level,
    message: n.message,
    fieldPath: n.fieldPath,
    formulaField: n.formulaField,
  }));

  return processAndSaveNotifications(orgId, documentId, notificationsToProcess);
}

/**
 * Save a task-scoped notification to the database.
 * Used by scheduled tasks to create org-scoped notifications.
 *
 * @param orgId - Organization ID
 * @param level - Notification level (warning or error)
 * @param message - Notification message
 * @param metadata - Optional metadata for linking (e.g., { taskId: "..." })
 * @returns Created notification record
 */
export async function saveTaskNotification(
  orgId: string,
  level: NotificationLevel,
  message: string,
  metadata?: Record<string, unknown>
): Promise<NotificationRecord> {
  return createTaskNotification(orgId, {
    level,
    message,
    metadata,
  });
}

export type { DocumentNotification };
