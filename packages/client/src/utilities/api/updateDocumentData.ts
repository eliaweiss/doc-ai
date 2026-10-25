import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";

export interface UpdateDocumentDataRequest {
  headerData?: Record<string, unknown>;
  lineItems?:
    | Record<string, unknown>[]
    | Record<string, Record<string, unknown>[]>
    | null;
}

export interface UpdateDocumentDataResponse {
  success: boolean;
  documentData: {
    id: string;
    headerData: Record<string, unknown> | null;
    lineItems:
      | Record<string, unknown>[]
      | Record<string, Record<string, unknown>[]>
      | null;
    totalAmount: string | null;
    documentDate: string | null;
    dueDate: string | null;
    updatedAt: Date;
  };
}

export async function updateDocumentData(
  documentId: string,
  data: UpdateDocumentDataRequest
): Promise<UpdateDocumentDataResponse> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/documents/${documentId}/save-doc`,
    {
      method: "PUT",
      body: data as Record<string, unknown>,
    }
  );

  return response;
}
