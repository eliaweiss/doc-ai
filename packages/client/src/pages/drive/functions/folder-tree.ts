import { Folder } from "@zdocs/types";
import { FolderNode } from "../types/folder-node";
import { useDocsStore } from "../../../context-providers/docsStore";

export const expandFolderPath = (
  folderPath: Folder[],
  folderTree: FolderNode[]
) => {
  const { setFolderTree } = useDocsStore.getState();

  folderPath
    .slice(0, -1)
    .forEach((folder) => expandFolderInTree_helper(folder, folderTree));

  setFolderTree(folderTree);
};

export const toggleExpandFolderInTree = (folder: Folder) => {
  const { folderTree, setFolderTree } = useDocsStore.getState();
  expandFolderInTree_helper(folder, folderTree, { toggle: true });
  setFolderTree(folderTree);
};

export const expandFolderInTree = (folder: Folder) => {
  const { folderTree, setFolderTree } = useDocsStore.getState();
  const folderNode = findFolderInTree(folder.id);
  // Only expand if folder has children
  if (folderNode && folderNode.children.length > 0) {
    expandFolderInTree_helper(folder, folderTree);
    setFolderTree(folderTree);
  }
};

export const flattenFolderTree = (folderTree: FolderNode[]): FolderNode[] => {
  return folderTree.flatMap((folder) => [
    folder,
    ...flattenFolderTree(folder.children),
  ]);
};

export const findFolderInTree = (
  folderId: string | null
): FolderNode | undefined => {
  const { folderTree } = useDocsStore.getState();
  return flattenFolderTree(folderTree).find((f) => f.id === folderId);
};

export const removeFolderFromTree = (folder: Folder) => {
  if (!folder.parentId) {
    return;
  }
  const { folderTree, setFolderTree } = useDocsStore.getState();
  const parentFolderNode = findFolderInTree(folder.parentId);
  if (parentFolderNode) {
    parentFolderNode.children = parentFolderNode.children.filter(
      (child) => child.id !== folder.id
    );
  }
  setFolderTree(folderTree);
};

const expandFolderInTree_helper = (
  folder: Folder,
  folderTree: FolderNode[],
  options: { toggle?: boolean } = { toggle: false }
): void => {
  const folderNode = folderTree.find((f) => f.id === folder.id);
  if (folderNode) {
    if (options.toggle) {
      folderNode.isExpanded = !folderNode.isExpanded;
    } else {
      folderNode.isExpanded = true;
    }
  } else {
    folderTree.forEach((child) =>
      expandFolderInTree_helper(folder, child.children, options)
    );
  }
};

export const folderPathRecursive = (folderId: string): Folder[] => {
  const folder = findFolderInTree(folderId);
  if (folder) {
    return [...folderPathRecursive(folder.parentId!), folder];
  }
  return [];
};