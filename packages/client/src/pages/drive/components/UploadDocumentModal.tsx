"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { FilePicker } from "../../../components/ui/file-picker/FilePicker";
import { DropAccept } from "../../../utilities/handleClientUpload";
import { useDocsStore } from "../../../context-providers/docsStore";
import { fetchDocuments } from "../../../utilities/api/fetchDocuments";
import { fetchFolders } from "../../../utilities/api/fetchFolders";
import { FolderTree } from "./FolderTree";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import FolderPath from "./FolderPath";
import { folderPathRecursive } from "../functions/folder-tree";
import { Folder } from "@zdocs/types";

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadDocumentModal({
  isOpen,
  onClose,
}: UploadDocumentModalProps) {
  const { currentFolderId, folderTree, isLoadingFolders, setShowUploadOnInit, setIsUploadModalOpen } = useDocsStore();
  const t = useTranslations("drive");
  const tUpload = useTranslations("upload");
  const router = useRouter();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId
  );
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const hasClosedRef = useRef(false);

  useEffect(() => {
    if (selectedFolderId) {
      setFolderPath(folderPathRecursive(selectedFolderId));
    }
  }, [folderTree, selectedFolderId]);

  // Sync modal open state with store
  useEffect(() => {
    setIsUploadModalOpen(isOpen);
  }, [isOpen, setIsUploadModalOpen]);

  const handleModalClose = useCallback(() => {
    setShowUploadOnInit(false); // prevent from popping up again when browsing
    onClose();
  }, [onClose, setShowUploadOnInit]);

  // Initialize selected folder when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(currentFolderId);
      hasClosedRef.current = false;
      // Fetch folders if not already loaded
      if (folderTree.length === 0) {
        fetchFolders().catch(console.error);
      }
    }
  }, [isOpen, currentFolderId, folderTree.length]);

  // Close modal as soon as upload starts
  useEffect(() => {
    if (isUploading && !hasClosedRef.current) {
      hasClosedRef.current = true;
      handleModalClose();
    }
  }, [isUploading, handleModalClose]);

  const handleUploadComplete = async () => {
    setIsUploading(false);
    if (selectedFolderId && selectedFolderId !== currentFolderId) {
      router.push(`/folder/${selectedFolderId}`);
    }
    // Refresh documents list in background
    await fetchDocuments();
  };

  const handleSelectFolder = (folderId: string) => {
    console.log("handleSelectFolder", folderId);
    setSelectedFolderId(folderId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent data-testid="upload-document-modal" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {t("uploadDocument")}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4" data-testid="upload-document-content">
          {/* Folder Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FolderPath folderPath={folderPath} />
            </div>
            <div className="max-h-[200px] overflow-y-auto border border-border rounded-md p-2 bg-card">
              {isLoadingFolders && folderTree.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : folderTree.length > 0 ? (
                folderTree.map((folder) => (
                  <FolderTree
                    key={folder.id}
                    folder={folder}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={handleSelectFolder}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                  {t("noFolders")}
                </div>
              )}
            </div>
          </div>

          {/* File Upload */}
          <div>
            <FilePicker
              onSave={handleUploadComplete}
              multiple={true}
              isLoading={isUploading}
              setIsLoading={setIsUploading}
              acceptedFileTypes={{
                ...DropAccept.documents,
                ...DropAccept.images,
              }}
              dragAreaText={{
                title: tUpload("dropHere"),
                action: tUpload("clickToBrowse"),
                editAction: tUpload("clickToReplace"),
              }}
              uploadOptions={{ folderId: selectedFolderId }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
