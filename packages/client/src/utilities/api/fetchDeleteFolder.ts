import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { fetchFolders } from "./fetchFolders";

export async function fetchDeleteFolder(folderId: string) {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  await zFetch(`/api/org/${currentOrgId}/folders/${folderId}/delete`, {
    method: "POST",
  });

  // Refresh folders after deletion
  await fetchFolders();
}
