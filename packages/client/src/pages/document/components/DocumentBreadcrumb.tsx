"use client";

import { Folder } from "@zdocs/types";
import { Folder as FolderIcon, FileText, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@zdocs/util";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface DocumentBreadcrumbProps {
  folderPath: Folder[];
  documentName: string;
}

export function DocumentBreadcrumb({
  folderPath,
  documentName,
}: DocumentBreadcrumbProps) {
  const router = useRouter();
  const locale = useLocale();
  const { logEvent } = useLogUserJourneyEvent();

  const handleFolderClick = (folderId: string) => {
    const folder = folderPath.find((f) => f.id === folderId);
    logEvent({
      eventType: "document_breadcrumb_folder_clicked",
      eventData: {
        folderId,
        folderName: folder?.name,
      },
    });
    router.push(`/folder/${folderId}`);
  };

  return (
    <div
      className={cn("text-base sm:text-xl flex items-center gap-1 flex-wrap")}
      data-testid="document-breadcrumb"
    >
      {folderPath.map((folder, index) => (
        <div
          key={folder.id}
          className="flex items-center gap-1"
          data-testid={`breadcrumb-folder-${folder.id}`}
        >
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <div
            className="flex items-center cursor-pointer hover:text-primary transition-colors"
            onClick={() => handleFolderClick(folder.id)}
          >
            <FolderIcon className="w-4 h-4 mr-1 text-muted-foreground" />
            <span className="text-foreground">{folder.name}</span>
          </div>
        </div>
      ))}

      {/* Document name */}
      <div
        className="flex items-center gap-1"
        data-testid="breadcrumb-document"
      >
        {folderPath.length > 0 && (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex items-center">
          <FileText className="w-4 h-4 mr-1 text-primary" />
          <span className="text-foreground font-semibold">{documentName}</span>
        </div>
      </div>
    </div>
  );
}
