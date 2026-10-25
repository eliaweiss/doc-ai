import { Document } from "@zdocs/types";
import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";

/**
 * Fetch documents in a specific folder (for browsing, not using global store)
 * Returns documents without affecting the global docsStore state
 */
export async function fetchDocumentsInFolder(
  folderId: string | null
): Promise<Document[]> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(`/api/org/${org.id}/documents`, {
    method: "POST",
    body: { folderId },
  });

  return response?.documents || [];
}

