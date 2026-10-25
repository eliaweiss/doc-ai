import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";

export interface DocumentStatus {
  id: string;
  extractionStatus: string;
}

export interface FetchDocumentStatusesResponse {
  statuses: DocumentStatus[];
}

export async function fetchDocumentStatuses(
  documentIds: string[]
): Promise<DocumentStatus[]> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  if (documentIds.length === 0) {
    return [];
  }

  const response = await zFetch(
    `/api/org/${org.id}/documents/status`,
    {
      method: "POST",
      body: { documentIds },
    }
  );

  return response.statuses;
}

