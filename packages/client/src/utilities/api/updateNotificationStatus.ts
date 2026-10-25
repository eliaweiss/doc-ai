import { zFetch } from "../../lib/utils";
import type { NotificationRecord, NotificationStatus } from "@zdocs/types";

export interface UpdateNotificationStatusResponse {
  notification: NotificationRecord;
}

/**
 * Update notification status (RESOLVED, IGNORED, PENDING).
 */
export async function updateNotificationStatus(
  orgId: string,
  notificationId: string,
  status: NotificationStatus
): Promise<NotificationRecord> {
  const data = await zFetch(
    `/api/org/${orgId}/notifications/${notificationId}`,
    {
      method: "PATCH",
      body: { status },
    }
  );

  return data.notification;
}
