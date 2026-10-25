import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";

interface IndexDocumentResponse {
  success: boolean;
  indexed: number;
  message: string;
}

export async function indexDocumentApi(
  documentId: string
): Promise<IndexDocumentResponse> {
  const orgId = useOrgStore.getState().org?.id;
  if (!orgId) {
    throw new Error("No organization selected");
  }

  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/index`,
    {
      method: "POST",
    }
  );
}

