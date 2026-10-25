import { Folder } from "@zdocs/types";
import { FolderNode } from "../types/folder-node";
import { useDocsStore } from "../../../context-providers/docsStore";

export const buildFolderTree = (folders: Folder[]): FolderNode[] => {
  const folderMap: { [key: string]: FolderNode } = {};
  
  // Get existing expansion state to preserve it
  const existingTree = useDocsStore.getState().folderTree;
  const expansionMap = new Map<string, boolean>();
  
  const collectExpansionState = (nodes: FolderNode[]) => {
    nodes.forEach((node) => {
      expansionMap.set(node.id, node.isExpanded);
      collectExpansionState(node.children);
    });
  };
  collectExpansionState(existingTree);

  folders.forEach((folder) => {
    // Preserve expansion state if folder existed before, otherwise default to false
    const wasExpanded = expansionMap.get(folder.id) ?? false;
    folderMap[folder.id] = { ...folder, children: [], isExpanded: wasExpanded };
  });

  const tree: FolderNode[] = [];
  folders.forEach((folder) => {
    const folderNode = folderMap[folder.id];
    if (folder.parentId) {
      const parent = folderMap[folder.parentId];
      if (parent) {
        parent.children.push(folderNode);
      }
    } else {
      tree.push(folderNode);
    }
  });

  // Expand root folder by default only if it wasn't previously set
  if (tree.length > 0 && !expansionMap.has(tree[0].id)) {
    tree[0].isExpanded = true;
  }

  return tree;
};

