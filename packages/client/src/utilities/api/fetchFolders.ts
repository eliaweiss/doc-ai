import { zFetch } from "../../lib/utils";
import { useDocsStore } from "../../context-providers/docsStore";
import { buildFolderTree } from "../../pages/drive/functions/buildFolderTree";
import useOrgStore from "../../context-providers/orgStore";
import { Folder } from "@zdocs/types";

export async function fetchFolders() {
  const { org } = useOrgStore.getState();
  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  const { setFolderTree, setIsLoadingFolders } = useDocsStore.getState();

  setIsLoadingFolders(true);
  try {
    const response = await zFetch(
      `/api/org/${currentOrgId}/folders`,
      {
        method: "POST",
      }
    );

    const folders = response.folders || [];
    const folderTree = buildFolderTree(folders);
    setFolderTree(folderTree);

    return folders;
  } finally {
    setIsLoadingFolders(false);
  }
}
