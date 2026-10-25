"use client";
import { ReactNode, useEffect, useState, useRef } from "react";
import { useAppStore } from "./appStore";
import useOrgStore from "./orgStore";
import { useDocsStore } from "./docsStore";
import { fetchFolders } from "../utilities/api/fetchFolders";
import { fetchDocuments } from "../utilities/api/fetchDocuments";
import { fetchCreateFolder } from "../utilities/api/fetchCreateFolder";
import { buildFolderTree } from "../pages/drive/functions/buildFolderTree";
import { Folder } from "@zdocs/types";

export default function DriveProvider({ children, showUploadOnInit = false }: { children: ReactNode, showUploadOnInit?: boolean }) {
  const { loginUser, appInitialized } = useAppStore();
  const { org } = useOrgStore();

  const { setFolderTree, currentFolderId, setCurrentFolderId, setDocuments, setShowUploadOnInit } =
    useDocsStore();

  const [prevCurrentFolderId, setPrevCurrentFolderId] = useState<string | null>(
    null
  );

  // Track if we're creating "My Drive" to prevent duplicates
  const creatingMyDriveRef = useRef(false);

  useEffect(() => {
    setShowUploadOnInit(showUploadOnInit);
  }, [showUploadOnInit]);

  // Initialize folders when user/org changes
  useEffect(() => {
    if (!appInitialized || !org?.id) {
      return;
    }
    if (!loginUser) {
      setFolderTree([]);
      setDocuments([]);
      return;
    }

    console.log("Fetching folders for org:", org.id);
    fetchFolders()
      .then((folders) => {
        // Check if "My Drive" root folder exists
        const rootFolder = folders.find((f: Folder) => f.isRoot || !f.parentId);

        if (
          !rootFolder &&
          folders.length === 0 &&
          !creatingMyDriveRef.current
        ) {
          // Create "My Drive" folder only if it doesn't exist and we're not already creating it
          creatingMyDriveRef.current = true;
          fetchCreateFolder({
            parentId: null,
            name: "My Drive",
          })
            .then((folder) => {
              const folderTree = buildFolderTree([folder]);
              setFolderTree(folderTree);
              const currentId = useDocsStore.getState().currentFolderId;
              if (!currentId) {
                setCurrentFolderId(folder.id);
              }
            })
            .finally(() => {
              creatingMyDriveRef.current = false;
            });
        } else {
          const folderTree = buildFolderTree(folders);
          setFolderTree(folderTree);

          // Set current folder to root if not set
          // Read from store directly to avoid stale closure when URL navigation
          // has already set currentFolderId before this async callback runs
          const currentId = useDocsStore.getState().currentFolderId;
          if (!currentId && rootFolder) {
            setCurrentFolderId(rootFolder.id);
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching folders:", error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loginUser,
    appInitialized,
    org?.id,
    setFolderTree,
    setDocuments,
    setCurrentFolderId,
    // Removed currentFolderId to prevent re-running when folder is set
  ]);

  // Fetch documents when folder changes
  useEffect(() => {
    if (!appInitialized || !org?.id || !currentFolderId) {
      return;
    }

    if (prevCurrentFolderId !== currentFolderId) {
      setPrevCurrentFolderId(currentFolderId);
      fetchDocuments().catch((error) => {
        console.error("Error fetching documents:", error);
      });
    }
  }, [currentFolderId, appInitialized, org?.id, prevCurrentFolderId]);

  return (
    <>
      {children}
    </>
  );
}
