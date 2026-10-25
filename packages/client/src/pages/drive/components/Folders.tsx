"use client";
import { useDocsStore, RECENT_FOLDER_ID } from "../../../context-providers/docsStore";
import { useEffect } from "react";
import NewItemMenu from "./NewItemMenu";
import { FolderTree } from "./FolderTree";
import { expandFolderPath, findFolderInTree, folderPathRecursive } from "../functions/folder-tree";

export default function FoldersComponent() {
  const { setCurrentFolderId, currentFolderId, folderTree, setFolderPath } =
    useDocsStore();

  useEffect(() => {
    if (folderTree.length > 0 && currentFolderId !== RECENT_FOLDER_ID) {
      const currentFolder = findFolderInTree(currentFolderId!);
      if (!currentFolder) {
        const rootFolder = folderTree[0];
        setCurrentFolderId(rootFolder?.id || null);
      }
      const folderPath = folderPathRecursive(currentFolderId!);
      expandFolderPath(folderPath, folderTree);
      setFolderPath(folderPath);
    }
  }, [folderTree]);

  useEffect(() => {
    if (currentFolderId === RECENT_FOLDER_ID) {
      setFolderPath([]);
      return;
    }
    const folderPath = folderPathRecursive(currentFolderId!);
    expandFolderPath(folderPath, folderTree);
    setFolderPath(folderPath);
  }, [currentFolderId]);

  return (
    <div data-testid="folders-component">
      <NewItemMenu />

      <div className="overflow-y-auto overflow-x-auto" data-testid="folder-tree-container">
        {folderTree.map((folder) => (
          <FolderTree key={folder.id} folder={folder} />
        ))}
      </div>
    </div>
  );
}

