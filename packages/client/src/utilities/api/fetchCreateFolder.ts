import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { useDocsStore } from "../../context-providers/docsStore";
import { findFolderInTree } from "../../pages/drive/functions/folder-tree";
import { Folder } from "@zdocs/types";

interface CreateFolderParams {
  parentId: string | null;
  name: string;
}

interface CreateFolderResponse {
  folder: Folder;
}

export async function fetchCreateFolder({
  parentId,
  name,
}: CreateFolderParams) {
  const { org } = useOrgStore.getState();
  const { folderTree, setFolderTree } = useDocsStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;

  const response = (await zFetch(`/api/org/${currentOrgId}/folders/create`, {
    method: "POST",
    body: { parentId, name },
  })) as CreateFolderResponse;

  const folder = response.folder;

  // Update tree client-side (matching editor-app approach)
  const parentFolder = findFolderInTree(folder.parentId);
  if (parentFolder) {
    parentFolder.children.push({ ...folder, children: [], isExpanded: false });
    setFolderTree([...folderTree]); // Create new reference to trigger re-render
  } else {
    // Root level folder - add to tree root
    folderTree.push({ ...folder, children: [], isExpanded: false });
    setFolderTree([...folderTree]);
  }

  return folder;
}
