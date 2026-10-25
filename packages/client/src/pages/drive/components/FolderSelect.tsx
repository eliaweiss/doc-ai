import { FolderNode } from "./FolderTree";
import { FolderIcon } from "lucide-react";
import { cn } from "@zdocs/client-component";

interface FolderSelectProps {
  folder: FolderNode;
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  onConfirm?: (folderId: string) => void;
  excludeFolderId?: string;
}

export function FolderSelect({
  folder,
  selectedFolderId,
  onSelect,
  onConfirm,
  excludeFolderId,
}: FolderSelectProps) {
  if (excludeFolderId && folder.id === excludeFolderId) {
    return null;
  }

  return (
    <div className="ml-4" data-testid={`folder-select-${folder.id}`}>
      <div
        className={cn("py-1 px-2 cursor-pointer rounded hover:bg-accent flex items-center",
          selectedFolderId === folder.id ? "bg-secondary border border-border" : "")}
        onClick={() => onSelect(folder.id)}
        onDoubleClick={() => onConfirm?.(folder.id)}
        data-testid={`folder-select-item-${folder.id}`}
      >
        <FolderIcon className="w-4 h-4 mr-2 text-muted-foreground" />
        <span className="text-foreground">{folder.name}</span>
      </div>
      {folder.children.map((child) => (
        <FolderSelect
          key={child.id}
          folder={child}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          onConfirm={onConfirm}
          excludeFolderId={excludeFolderId}
        />
      ))}
    </div>
  );
}

