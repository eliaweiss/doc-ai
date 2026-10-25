"use client";
import { Folder } from "@zdocs/types";
import { Folder as FolderIcon, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDocsStore } from "../../../context-providers/docsStore";
import { expandFolderInTree } from "../functions/folder-tree";

interface FolderPathProps {
  folderPath: Folder[];
}

export default function FolderPath({ folderPath }: FolderPathProps) {
  const { currentFolderId, setCurrentFolderId } = useDocsStore();
  const router = useRouter();

  const handleClick = (folderId: string) => {
    setCurrentFolderId(folderId);
    router.push(`/folder/${folderId}`);
  };

  return (
    <div
      className="text-base md:text-xl flex items-center gap-1 "
      data-testid="folder-path"
    >
      {folderPath.map((folder, index) => (
        <div
          key={folder.id}
          className={`flex items-center gap-1 ${folder.id === currentFolderId ? "font-bold" : ""
            }`}
          data-testid={`folder-path-item-${folder.id}`}
        >
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <div
            className="flex items-center cursor-pointer hover:text-primary"
            onClick={() => {
              expandFolderInTree(folder);
              handleClick(folder.id);
            }}
          >
            <FolderIcon className="w-4 h-4 mr-1 text-muted-foreground" />
            <span className="text-foreground">{folder.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
