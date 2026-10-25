import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { useDocsStore } from "../../context-providers/docsStore";

export async function fetchDeleteDocument(documentId: string) {
  const { org } = useOrgStore.getState();
  const { removeDocument } = useDocsStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  await zFetch(`/api/org/${currentOrgId}/documents/${documentId}/delete`, {
    method: "POST",
  });

  // Remove from local state
  removeDocument(documentId);
}
