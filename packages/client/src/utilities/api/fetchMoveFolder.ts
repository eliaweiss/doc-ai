import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { fetchFolders } from "./fetchFolders";

interface MoveFolderParams {
  folderId: string;
  parentId: string;
}

export async function fetchMoveFolder({
  folderId,
  parentId,
}: MoveFolderParams) {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  await zFetch(`/api/org/${currentOrgId}/folders/${folderId}/move`, {
    method: "POST",
    body: { parentId },
  });

  // Refresh folders after move
  await fetchFolders();
}
