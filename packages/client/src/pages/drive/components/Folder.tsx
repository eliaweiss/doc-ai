"use client";
import { useDocsStore } from "../../../context-providers/docsStore";
import { fetchDeleteFolder } from "../../../utilities/api/fetchDeleteFolder";
import { Folder } from "@zdocs/types";
import { Folder as FolderIcon, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContextMenu } from "@zdocs/client-component";
import { RenameFolderModal } from "./RenameFolderModal";
import { MoveFolderModal } from "./MoveFolderModal";
import { useRouter } from "next/navigation";
import { fetchMoveDocument } from "../../../utilities/api/fetchMoveDocument";
import { expandFolderInTree } from "../functions/folder-tree";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface FolderProps {
  folder: Folder;
}

export default function FolderComponent({ folder }: FolderProps) {
  const { setCurrentFolderId } = useDocsStore();
  const router = useRouter();
  const { logEvent } = useLogUserJourneyEvent();
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderId: string | null;
  }>({ x: 0, y: 0, folderId: null });

  const handleSelect = (folderId: string) => {
    logEvent({
      eventType: "browse_folder_selected",
      eventData: {
        folderId,
        folderName: folder.name,
      },
    });
    // Expand the folder to show its immediate subfolders
    expandFolderInTree(folder);
    setCurrentFolderId(folderId);
    router.push(`/folder/${folderId}`);
  };

  const handleRightClick = (event: React.MouseEvent, folderId: string) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, folderId });
    logEvent({
      eventType: "browse_folder_context_menu_opened",
      eventData: {
        folderId,
      },
    });
  };

  const handleDeleteFolder = (folderId: string) => {
    console.log("Deleting folder:", folderId);
    logEvent({
      eventType: "browse_folder_deleted",
      eventData: {
        folderId,
      },
    });
    setContextMenu({ x: 0, y: 0, folderId: null });
    fetchDeleteFolder(folderId).catch((error) => {
      toast.error(`${error}`);
    });
  };

  const handleRenameClick = () => {
    logEvent({
      eventType: "browse_folder_rename_opened",
      eventData: {
        folderId: folder.id,
      },
    });
    setShowRenameModal(true);
    setContextMenu({ x: 0, y: 0, folderId: null });
  };

  const handleMoveClick = () => {
    logEvent({
      eventType: "browse_folder_move_opened",
      eventData: {
        folderId: folder.id,
      },
    });
    setShowMoveModal(true);
    setContextMenu({ x: 0, y: 0, folderId: null });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're leaving the element itself (not a child)
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      const dragData = JSON.parse(data);
      const documentIds = dragData.documentIds || [];
      const documentNames = dragData.documentNames || [];

      if (documentIds.length === 0) return;

      // Move all selected documents
      const movePromises = documentIds.map((documentId: string) =>
        fetchMoveDocument({
          documentId,
          folderId: folder.id,
        })
      );

      await Promise.all(movePromises);

      if (documentIds.length === 1) {
        toast.success(`Moved "${documentNames[0]}" to "${folder.name}"`);
      } else {
        toast.success(
          `Moved ${documentIds.length} documents to "${folder.name}"`
        );
      }
    } catch (error) {
      console.error("Error moving documents:", error);
      toast.error("Failed to move documents");
    }
  };

  return (
    <>
      <li
        onClick={() => handleSelect(folder.id)}
        onContextMenu={(event) => handleRightClick(event, folder.id)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`cursor-pointer flex items-center grow list-none rounded-md transition-colors ${
          isDragOver
            ? "bg-primary/20 border-2 border-primary border-dashed"
            : ""
        }`}
        data-testid={`folder-item-${folder.id}`}
      >
        <FolderIcon className="w-5 h-5 mr-2 text-muted-foreground" />
        <span className="text-sm text-foreground">{folder.name}</span>
      </li>

      {contextMenu.folderId && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ x: 0, y: 0, folderId: null })}
        >
          <ul>
            <li
              className="p-2 hover:bg-accent cursor-pointer flex items-center text-foreground"
              onClick={handleMoveClick}
              data-testid="folder-context-move"
            >
              <FolderIcon className="w-4 h-4 mr-2" />
              Move to
            </li>
            <li
              className="p-2 hover:bg-accent cursor-pointer flex items-center text-foreground"
              onClick={() => handleRenameClick()}
              data-testid="folder-context-rename"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Rename Folder
            </li>
            <li
              className="p-2 hover:bg-accent cursor-pointer flex items-center text-destructive"
              onClick={() => handleDeleteFolder(contextMenu.folderId!)}
              data-testid="folder-context-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Folder
            </li>
          </ul>
        </ContextMenu>
      )}

      <RenameFolderModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        folderId={folder.id}
        folderName={folder.name}
      />

      <MoveFolderModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        folderId={folder.id}
        folderName={folder.name}
      />
    </>
  );
}
