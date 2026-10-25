import type { NotificationRecord } from "@zdocs/types";
import { zFetch } from "../../lib/utils";

export interface FetchNotificationsResponse {
  notifications: NotificationRecord[];
}

/**
 * Fetch active notifications (NEW/PENDING, warning/error only) for the organization.
 */
export async function fetchNotifications(
  orgId: string
): Promise<NotificationRecord[]> {
  const data = await zFetch(
    `/api/org/${orgId}/notifications`,
    {
      method: "GET",
    }
  );

  return data.notifications;
}
