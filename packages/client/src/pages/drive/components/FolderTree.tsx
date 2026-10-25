"use client";
import FolderComponent from "./Folder";
import { Folder } from "@zdocs/types";
import { useDocsStore } from "../../../context-providers/docsStore";
import { toggleExpandFolderInTree } from "../functions/folder-tree";
import { Folder as FolderIcon } from "lucide-react";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

export interface FolderNode extends Folder {
  children: FolderNode[];
  isExpanded: boolean;
}

interface FolderTreeProps {
  folder: FolderNode;
  selectedFolderId?: string | null;
  onSelectFolder?: (folderId: string) => void;
}

export const FolderTree = ({ 
  folder, 
  selectedFolderId,
  onSelectFolder 
}: FolderTreeProps) => {
  const { currentFolderId } = useDocsStore();
  const { logEvent } = useLogUserJourneyEvent();
  const toggleExpandFolder = () => {
    const wasExpanded = folder.isExpanded;
    toggleExpandFolderInTree(folder);
    logEvent({
      eventType: wasExpanded ? "browse_folder_collapsed" : "browse_folder_expanded",
      eventData: {
        folderId: folder.id,
        folderName: folder.name,
      },
    });
  };

  const isSelected = selectedFolderId !== undefined 
    ? selectedFolderId === folder.id 
    : currentFolderId === folder.id;

  return (
    <div className="mt-2" data-testid={`folder-tree-${folder.id}`}>
      <div
        className={`pl-2 rounded-md ${
          isSelected ? "bg-accent" : ""
        }`}
      >
        <div className="flex items-center">
          <button
            onClick={() => toggleExpandFolder()}
            className="pr-2"
            data-testid={`folder-expand-btn-${folder.id}`}
          >
            {folder.children.length > 0 ? (
              <div className="w-[16px] text-[24px] overflow-hidden text-muted-foreground">
                {folder.isExpanded ? "▾" : "▸"}
              </div>
            ) : (
              <div className="w-[16px]">&nbsp;</div>
            )}
          </button>
          {onSelectFolder ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelectFolder(folder.id);
              }}
              className="cursor-pointer flex items-center grow list-none rounded-md transition-colors hover:bg-accent/50"
              data-testid={`folder-select-item-${folder.id}`}
            >
              <FolderIcon className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-sm text-foreground">{folder.name}</span>
            </div>
          ) : (
            <FolderComponent folder={folder} />
          )}
        </div>
      </div>

      {folder.isExpanded && folder.children.length > 0 && (
        <div className="ml-2">
          {folder.children.map((childFolder) => (
            <FolderTree 
              key={childFolder.id} 
              folder={childFolder}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};
