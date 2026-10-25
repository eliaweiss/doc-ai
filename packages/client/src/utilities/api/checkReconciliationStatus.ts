import { ReconciliationPairRef } from "@zdocs/types";
import { zFetch } from "../../lib/utils";

export interface CheckReconciliationStatusRequest {
  entityIds: string[];
  targetEntityKey: string;
}

export interface CheckReconciliationStatusResponse {
  reconciledIds: ReconciliationPairRef[];
}

export async function checkReconciliationStatus(
  orgId: string,
  entityIds: string[],
  targetEntityKey: string,
  side: "source" | "target"
): Promise<ReconciliationPairRef[]> {
  if (side === "target") {
    const response = await zFetch(
      `/api/org/${orgId}/reconciliation/get-reconciled-TypeToIds`,
      {
        method: "POST",
        body: { entityIds, targetEntityKey },
      }
    );
    return response.reconciledIds;
  }
  const response = await zFetch(
    `/api/org/${orgId}/reconciliation/get-reconciled-IdsToType`,
    {
      method: "POST",
      body: { entityIds, targetEntityKey },
    }
  );
  return response.reconciledIds;
}
