import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { fetchDocuments } from "./fetchDocuments";

interface MoveDocumentParams {
  documentId: string;
  folderId: string;
}

export async function fetchMoveDocument({
  documentId,
  folderId,
}: MoveDocumentParams) {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  await zFetch(`/api/org/${currentOrgId}/documents/${documentId}/move`, {
    method: "POST",
    body: { folderId },
  });

  // Refresh documents after move
  await fetchDocuments();
}
