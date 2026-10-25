import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { fetchFolders } from "./fetchFolders";

interface RenameFolderParams {
  folderId: string;
  name: string;
}

export async function fetchRenameFolder({ folderId, name }: RenameFolderParams) {
  const { org } = useOrgStore.getState();
  
  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  await zFetch(`/api/org/${currentOrgId}/folders/${folderId}/rename`, {
    method: "POST",
    body: { name },
  });

  // Refresh folders after rename
  await fetchFolders();
}

