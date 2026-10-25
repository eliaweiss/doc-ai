import { zFetch } from "../../lib/utils";
import { useDocsStore } from "../../context-providers/docsStore";
import { buildFolderTree } from "../../pages/drive/functions/buildFolderTree";
import useOrgStore from "../../context-providers/orgStore";

export async function createFolder(name: string, parentId: string | null = null): Promise<string> {
  const { org } = useOrgStore.getState();
  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(`/api/org/${org.id}/folders/create`, {
    method: "POST",
    body: { name, parentId },
  });

  // Refresh the folder tree
  const { setFolderTree } = useDocsStore.getState();
  const refreshResponse = await zFetch(`/api/org/${org.id}/folders`, { method: "POST" });
  const folders = refreshResponse.folders || [];
  setFolderTree(buildFolderTree(folders));

  return response.folder.id;
}
