"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { useDocsStore } from "../../../context-providers/docsStore";
import { fetchFolders } from "../../../utilities/api/fetchFolders";
import { fetchDocumentsInFolder } from "../../../utilities/api/fetchDocumentsInFolder";
import {
  Loader2,
  FolderIcon,
  ChevronRight,
  ChevronDown,
  FileText,
} from "lucide-react";
import type { Document } from "@zdocs/types";
import type { FolderNode } from "../../drive/types/folder-node";
import { cn } from "@zdocs/util";

interface DocumentSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (document: Document) => void;
  title?: string;
}

interface FolderWithDocuments extends FolderNode {
  documents: Document[];
  documentsLoaded: boolean;
  documentsLoading: boolean;
}

function buildFolderWithDocuments(folder: FolderNode): FolderWithDocuments {
  return {
    ...folder,
    documents: [],
    documentsLoaded: false,
    documentsLoading: false,
    children: folder.children.map(buildFolderWithDocuments),
  };
}

export function DocumentSelectDialog({
  isOpen,
  onClose,
  onSelect,
  title,
}: DocumentSelectDialogProps) {
  const tReconciliation = useTranslations("reconciliation");
  const driveT = useTranslations("drive");
  const { folderTree, isLoadingFolders } = useDocsStore();

  const [localFolderTree, setLocalFolderTree] = useState<FolderWithDocuments[]>(
    []
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Initialize folder tree when dialog opens and reset selection when closed
  useEffect(() => {
    if (isOpen) {
      fetchFolders().catch(console.error);
    } else {
      // Reset selection when dialog closes
      setSelectedDocumentId(null);
      setSelectedDocument(null);
    }
  }, [isOpen]);

  // Build local folder tree with documents when folderTree changes
  useEffect(() => {
    if (folderTree.length > 0) {
      setLocalFolderTree(folderTree.map(buildFolderWithDocuments));
      // console.log("folderTree", folderTree);

      // open root folder by default
      setExpandedFolders(new Set(folderTree[0].id));
      toggleFolder(folderTree[0].id);
    }
  }, [folderTree]);

  const loadDocumentsForFolder = useCallback(async (folderId: string) => {
    // Find and update the folder in the tree
    const updateFolder = (
      folders: FolderWithDocuments[]
    ): FolderWithDocuments[] => {
      return folders.map((folder) => {
        if (folder.id === folderId) {
          return { ...folder, documentsLoading: true };
        }
        return {
          ...folder,
          children: updateFolder(
            folder.children as FolderWithDocuments[]
          ) as FolderWithDocuments[],
        };
      });
    };

    setLocalFolderTree((prev) => updateFolder(prev));

    try {
      const documents = await fetchDocumentsInFolder(folderId);

      // Filter to only show documents that have been extracted
      const extractedDocs = documents.filter(
        (doc) =>
          doc.extractionStatus === "EXTRACTED" ||
          doc.extractionStatus === "INDEXED"
      );

      const updateWithDocs = (
        folders: FolderWithDocuments[]
      ): FolderWithDocuments[] => {
        return folders.map((folder) => {
          if (folder.id === folderId) {
            return {
              ...folder,
              documents: extractedDocs,
              documentsLoaded: true,
              documentsLoading: false,
            };
          }
          return {
            ...folder,
            children: updateWithDocs(
              folder.children as FolderWithDocuments[]
            ) as FolderWithDocuments[],
          };
        });
      };

      setLocalFolderTree((prev) => updateWithDocs(prev));
    } catch (error) {
      console.error("Failed to load documents for folder:", error);
      const updateError = (
        folders: FolderWithDocuments[]
      ): FolderWithDocuments[] => {
        return folders.map((folder) => {
          if (folder.id === folderId) {
            return { ...folder, documentsLoading: false };
          }
          return {
            ...folder,
            children: updateError(
              folder.children as FolderWithDocuments[]
            ) as FolderWithDocuments[],
          };
        });
      };
      setLocalFolderTree((prev) => updateError(prev));
    }
  }, []);

  const toggleFolder = useCallback(
    (folderId: string) => {
      setExpandedFolders((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(folderId)) {
          newSet.delete(folderId);
        } else {
          // console.log("adding folder", folderId);
          newSet.add(folderId);
          // Load documents if not already loaded
          const findFolder = (
            folders: FolderWithDocuments[]
          ): FolderWithDocuments | null => {
            for (const folder of folders) {
              if (folder.id === folderId) return folder;
              const found = findFolder(
                folder.children as FolderWithDocuments[]
              );
              if (found) return found;
            }
            return null;
          };

          const folder = findFolder(localFolderTree);
          if (folder && !folder.documentsLoaded && !folder.documentsLoading) {
            loadDocumentsForFolder(folderId);
          }
        }
        return newSet;
      });
    },
    [localFolderTree, loadDocumentsForFolder]
  );

  const handleDocumentClick = useCallback((document: Document) => {
    setSelectedDocumentId(document.id);
    setSelectedDocument(document);
    onSelect(document);
    onClose();
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedDocument) {
      onSelect(selectedDocument);
      onClose();
    }
  }, [selectedDocument, onSelect, onClose]);

  const renderFolder = (
    folder: FolderWithDocuments,
    depth: number = 0
  ): React.ReactNode => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren =
      folder.children.length > 0 || folder.documents.length > 0;

    return (
      <div key={folder.id} data-testid={`folder-item-${folder.id}`}>
        <div
          className={cn(
            "flex items-center py-1.5 px-2 cursor-pointer rounded hover:bg-accent",
            "transition-colors"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => toggleFolder(folder.id)}
        >
          <span className="w-4 h-4 mr-1 flex items-center justify-center">
            {hasChildren || !folder.documentsLoaded ? (
              isExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )
            ) : null}
          </span>
          <FolderIcon className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="text-sm text-foreground truncate">
            {folder.name}
          </span>
          {folder.documentsLoading && (
            <Loader2 className="w-3 h-3 ml-2 animate-spin text-muted-foreground" />
          )}
        </div>

        {isExpanded && (
          <div>
            {/* Child folders */}
            {(folder.children as FolderWithDocuments[]).map((child) =>
              renderFolder(child, depth + 1)
            )}

            {/* Documents */}
            {folder.documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "flex items-center py-1.5 px-2 cursor-pointer rounded hover:bg-accent",
                  "transition-colors",
                  selectedDocumentId === doc.id &&
                    "bg-accent ring-1 ring-primary"
                )}
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                onClick={() => handleDocumentClick(doc)}
                data-testid={`document-item-${doc.id}`}
              >
                <span className="w-4 h-4 mr-1" />
                <FileText className="w-4 h-4 mr-2 text-primary" />
                <span className="text-sm text-foreground truncate flex-1">
                  {doc.fileName || doc.description || doc.id}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {doc.docType}
                </span>
              </div>
            ))}

            {/* Empty state for documents */}
            {folder.documentsLoaded &&
              folder.documents.length === 0 &&
              folder.children.length === 0 && (
                <div
                  className="py-1.5 px-2 text-xs text-muted-foreground"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                >
                  {driveT("noDocuments")}
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="document-select-dialog"
        className="sm:max-w-[500px] max-h-[80vh] flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>
            {title || tReconciliation("selectDocument")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="h-[400px] overflow-y-auto border border-border rounded-md p-2">
            {isLoadingFolders && localFolderTree.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : localFolderTree.length > 0 ? (
              localFolderTree.map((folder) => renderFolder(folder))
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {driveT("noFolders")}
              </div>
            )}
          </div>
        </div>

        {selectedDocument && (
          <div className="py-2 px-3 bg-muted/50 rounded-md text-sm">
            <span className="font-medium">Selected:</span>{" "}
            {selectedDocument.fileName ||
              selectedDocument.description ||
              selectedDocument.id}
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="cancel-btn">
            {tReconciliation("cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDocument}
            data-testid="confirm-btn"
          >
            {tReconciliation("select")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
