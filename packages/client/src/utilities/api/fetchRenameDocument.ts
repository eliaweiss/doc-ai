import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { fetchDocuments } from "./fetchDocuments";

interface RenameDocumentParams {
  documentId: string;
  fileName: string;
}

export async function fetchRenameDocument({ documentId, fileName }: RenameDocumentParams) {
  const { org } = useOrgStore.getState();
  
  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  await zFetch(`/api/org/${currentOrgId}/documents/${documentId}/update`, {
    method: "POST",
    body: { fileName },
  });

  // Refresh documents after rename
  await fetchDocuments();
}

