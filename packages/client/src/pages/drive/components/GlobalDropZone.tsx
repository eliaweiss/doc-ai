"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDocsStore } from "../../../context-providers/docsStore";
import {
  handleClientUpload,
  DropAccept,
} from "../../../utilities/handleClientUpload";
import { fetchDocuments } from "../../../utilities/api/fetchDocuments";

interface GlobalDropZoneProps {
  children: React.ReactNode;
}

export default function GlobalDropZone({ children }: GlobalDropZoneProps) {
  const { currentFolderId, isUploadModalOpen } = useDocsStore();
  const tUpload = useTranslations("upload");
  const tDrive = useTranslations("drive");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      try {
        // Start all uploads
        await Promise.all(
          acceptedFiles.map((file) =>
            handleClientUpload(file, { folderId: currentFolderId })
          )
        );

        // Refresh documents list to show newly created entries
        await fetchDocuments();
      } catch (error) {
        console.error("Global drop upload failed:", error);
      }
    },
    [currentFolderId]
  );

  const onDropRejected = useCallback(
    (fileRejections: any[]) => {
      if (fileRejections.length > 0) {
        const acceptedTypes = {
          ...DropAccept.documents,
          ...DropAccept.images,
        };
        const validExtensions = Object.keys(acceptedTypes)
          .map((mimeType) =>
            acceptedTypes[mimeType].map((ext) => ext.replace(".", ""))
          )
          .flat()
          .join(", ");
        const fileNames = fileRejections
          .map((rejection) => rejection.file.name)
          .join(", ");
        const errorMessage = validExtensions
          ? tUpload("invalidFileType", {
              files: fileNames,
              extensions: validExtensions,
            })
          : tUpload("invalidFileTypeNoExtensions", { files: fileNames });
        toast.error(errorMessage);
      }
    },
    [tUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    noClick: true,
    noKeyboard: true,
    disabled: isUploadModalOpen,
    accept: {
      ...DropAccept.documents,
      ...DropAccept.images,
    },
  });

  return (
    <div {...getRootProps()} className="h-full w-full" data-testid="global-drop-zone">
      <input {...getInputProps()} />

      {/* Main Page Content */}
      {children}

      {/* Full Screen Overlay */}
      {isDragActive && !isUploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-[2px] transition-all duration-300 pointer-events-none">
          <div className="rounded-xl border-4 border-dashed border-primary bg-background/90 p-12 flex flex-col items-center justify-center gap-4 max-w-lg w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="w-12 h-12 text-primary animate-bounce" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {tUpload("dropHere")}
              </h3>
              <p className="text-muted-foreground">
                {tDrive("uploadDocument")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
