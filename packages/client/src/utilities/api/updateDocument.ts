import { zFetch } from "../../lib/utils";
import { Document } from "@zdocs/types";
import useOrgStore from "../../context-providers/orgStore";

export interface UpdateDocumentRequest {
  fileName?: string | null;
  institutionId?: string | null; // Institution name is looked up from institutions table
  currency?: string | null;
  description?: string | null;
}

export interface UpdateDocumentResponse {
  document: Document;
}

export async function updateDocument(
  documentId: string,
  data: UpdateDocumentRequest
): Promise<UpdateDocumentResponse> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/documents/${documentId}/update`,
    {
      method: "POST",
      body: data as Record<string, unknown>,
    }
  );

  return response;
}
