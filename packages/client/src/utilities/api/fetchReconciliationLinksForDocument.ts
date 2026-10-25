import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";

export async function fetchReconciliationLinksForDocument(documentId: string) {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  const response = await zFetch(
    `/api/org/${currentOrgId}/documents/${documentId}/get-reconciliation`,
    {
      method: "POST",
    }
  );

  return response.links;
}
