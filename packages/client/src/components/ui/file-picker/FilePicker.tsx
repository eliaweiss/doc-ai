"use client";
import { useState, useEffect, useMemo } from "react";
import React from "react";
import {
  handleClientUpload,
  RequestEntityTooLarge413Error,
} from "../../../utilities/handleClientUpload";
import { BlobAccessError } from "@vercel/blob";
import Dropzone from "react-dropzone";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import {
  UploadIcon,
  XIcon,
  FileIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@zdocs/client-component";

interface UploadOptions {
  isTest?: boolean;
  folderId?: string | null;
  processingMode?: "DEFAULT" | "DATA_SOURCE_FILE";
}

export interface UploadResult {
  url: string;
  file: File;
}

interface FilePickerProps {
  defaultFile?: string | null;
  onSave: (
    url: string,
    file: File,
    options?: { documentId?: string }
  ) => void;
  onSaveMultiple?: (results: UploadResult[]) => void;
  multiple?: boolean;
  onSkip?: () => void;
  onClose?: () => void;
  isLoading?: boolean;
  setIsLoading?: (loading: boolean) => void;
  fileChangedCallback?: ((file: File) => void) | null;
  acceptedFileTypes?: Record<string, string[]> | null;
  withResetAfterUpload?: boolean;
  enableImageCrop?: boolean;
  aspectRatio?: number;
  previewComponent?: ((props: { src: string }) => React.ReactNode) | null;
  dragAreaText?: {
    title: string;
    action: string;
    editAction: string;
  };
  validateFile?: ((file: File) => string | null) | null;
  uploadOptions?: UploadOptions;
}

interface FileUploadState {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  url?: string;
  error?: string;
}

interface DragAreaProps {
  src: string | null;
  onClose: () => void;
  renderPreview: (src: string | null) => React.ReactNode;
  dragAreaText: {
    title: string;
    action: string;
    editAction: string;
  };
  multiple?: boolean;
  fileCount?: number;
}

export function FilePicker({
  defaultFile = null,
  onSave,
  onSaveMultiple,
  multiple = false,
  onSkip,
  onClose,
  isLoading,
  setIsLoading,
  fileChangedCallback = null,
  acceptedFileTypes = null,
  withResetAfterUpload = false,
  enableImageCrop = false,
  aspectRatio = 1,
  previewComponent = null,
  dragAreaText = {
    title: "Drag a file",
    action: "or Tap to upload",
    editAction: "or Tap to Edit",
  },
  validateFile = null,
  uploadOptions = {},
}: FilePickerProps) {
  const t = useTranslations("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultFile);
  const [dropAccept, setDropAccept] = useState<Record<string, string[]> | null>(
    acceptedFileTypes
  );
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [isCropperVisible, setCropperVisible] = useState(false);
  const [multipleFiles, setMultipleFiles] = useState<FileUploadState[]>([]);

  useEffect(() => {
    if (defaultFile !== undefined) {
      setPreviewUrl(defaultFile);
    }
    if (acceptedFileTypes !== undefined) {
      setDropAccept(acceptedFileTypes);
    }
  }, [defaultFile, acceptedFileTypes]);

  const isFileFormatValid = (file: File) => {
    const fileName = file.name;
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
    if (!acceptedFileTypes) {
      return true;
    }
    const validExtensions = Object.keys(acceptedFileTypes)
      .map((mimeType) =>
        acceptedFileTypes[mimeType].map((ext) => ext.replace(".", ""))
      )
      .flat();
    return validExtensions.includes(fileExtension);
  };

  const handleSaveFile = async (fileToUpload: File) => {
    if (!fileToUpload) return;

    if (!isFileFormatValid(fileToUpload)) {
      if (!acceptedFileTypes) return;
      const validExtensions = Object.keys(acceptedFileTypes)
        .map((mimeType) =>
          acceptedFileTypes[mimeType].map((ext) => ext.replace(".", ""))
        )
        .flat()
        .join(", ");
      setUploadErrorMsg(`Please upload only ${validExtensions} files`);
      return;
    }

    if (validateFile) {
      const validationError = validateFile(fileToUpload);
      if (validationError) {
        setUploadErrorMsg(validationError);
        return;
      }
    }

    setIsLoading?.(true);
    try {
      const { url, documentId } = await handleClientUpload(
        fileToUpload,
        uploadOptions
      );

      onSave(url, fileToUpload, { documentId });
      if (withResetAfterUpload) {
        setPreviewUrl(null);
      }
    } catch (error) {
      if (error instanceof BlobAccessError) {
        setUploadErrorMsg(error.message);
      } else if (error instanceof RequestEntityTooLarge413Error) {
        setUploadErrorMsg("File is too large, please try again");
      } else if (error instanceof Error) {
        setUploadErrorMsg(error.message);
      }
      setIsLoading?.(false);
    }
  };

  const handleSaveMultipleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Validate all files first
    const invalidFiles: string[] = [];
    for (const file of files) {
      if (!isFileFormatValid(file)) {
        invalidFiles.push(file.name);
      } else if (validateFile) {
        const validationError = validateFile(file);
        if (validationError) {
          invalidFiles.push(`${file.name}: ${validationError}`);
        }
      }
    }

    if (invalidFiles.length > 0) {
      const validExtensions = acceptedFileTypes
        ? Object.keys(acceptedFileTypes)
          .map((mimeType) =>
            acceptedFileTypes[mimeType].map((ext) => ext.replace(".", ""))
          )
          .flat()
          .join(", ")
        : "";
      setUploadErrorMsg(
        `Invalid files: ${invalidFiles.join(", ")}${validExtensions ? `. Allowed: ${validExtensions}` : ""
        }`
      );
      return;
    }

    // Initialize file states
    const initialStates: FileUploadState[] = files.map((file) => ({
      file,
      status: "pending",
    }));
    setMultipleFiles(initialStates);
    setIsLoading?.(true);

    const results: UploadResult[] = [];

    // Upload files concurrently
    await Promise.all(
      files.map(async (file, index) => {
        // Update status to uploading
        setMultipleFiles((prev) =>
          prev.map((f, i) => (i === index ? { ...f, status: "uploading" } : f))
        );

        try {
          const { url } = await handleClientUpload(file, uploadOptions);
          results.push({ url, file });

          // Update status to success
          setMultipleFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: "success", url } : f
            )
          );
        } catch (error) {
          const errorMessage =
            error instanceof BlobAccessError
              ? error.message
              : error instanceof RequestEntityTooLarge413Error
                ? "File is too large"
                : error instanceof Error
                  ? error.message
                  : "Upload failed";

          // Update status to error
          setMultipleFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: "error", error: errorMessage } : f
            )
          );
        }
      })
    );

    setIsLoading?.(false);

    // Call callback with successful uploads
    if (results.length > 0) {
      if (onSaveMultiple) {
        onSaveMultiple(results);
      } else {
        // Fallback to calling onSave for each file
        results.forEach(({ url, file }) => onSave(url, file));
      }
    }

    if (withResetAfterUpload) {
      setMultipleFiles([]);
      setPreviewUrl(null);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setUploadErrorMsg(null);
    setMultipleFiles([]);
    onClose?.();
  };

  const renderPreview = (src: string | null) => {
    if (previewComponent) {
      return previewComponent({ src: src || "" });
    }

    if (
      src &&
      acceptedFileTypes &&
      Object.keys(acceptedFileTypes).some((type) => type.startsWith("image/"))
    ) {
      return (
        <Image
          src={src || "/images/default-image.png"}
          alt="Preview"
          width={500}
          height={500}
          className="w-full h-full object-cover"
          data-testid="file-picker-image-preview"
        />
      );
    }

    return (
      <div
        className="flex-grow min-h-0 w-full max-w-[100px]"
        data-testid="file-picker-upload-icon"
      >
        <UploadIcon strokeWidth={1} className="h-full w-full chat-text" />
      </div>
    );
  };

  const renderMultipleFilesProgress = () => {
    if (multipleFiles.length === 0) return null;

    const completedCount = multipleFiles.filter(
      (f) => f.status === "success" || f.status === "error"
    ).length;
    const totalCount = multipleFiles.length;

    return (
      <div className="mt-4 space-y-2" data-testid="multiple-files-progress">
        <div className="text-sm text-muted-foreground mb-2">
          Uploading {completedCount}/{totalCount} files
        </div>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {multipleFiles.map((fileState, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
              data-testid={`upload-file-${index}`}
            >
              <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate flex-1">
                {fileState.file.name}
              </span>
              {fileState.status === "pending" && (
                <span className="text-xs text-muted-foreground">Pending</span>
              )}
              {fileState.status === "uploading" && (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
              {fileState.status === "success" && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {fileState.status === "error" && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-500">
                    {fileState.error}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNormalView = useMemo(
    () => (
      <div className="w-full" data-testid="file-picker-normal-view">
        <Dropzone
          onDrop={async (acceptedFiles: File[]) => {
            if (acceptedFiles.length > 0) {
              if (multiple && acceptedFiles.length >= 1) {
                // Multi-file mode
                await handleSaveMultipleFiles(acceptedFiles);
                acceptedFiles.forEach((file) => fileChangedCallback?.(file));
              } else {
                // Single file mode
                const file = acceptedFiles[0];

                if (enableImageCrop) {
                  setCropperVisible(true);
                } else {
                  await handleSaveFile(file);
                }

                fileChangedCallback?.(file);

                const reader = new FileReader();
                reader.onload = (e) => {
                  const result = e.target?.result;
                  if (typeof result === "string") {
                    setPreviewUrl(result);
                  }
                };
                reader.readAsDataURL(file);
              }
            }
          }}
          onDropRejected={(fileRejections) => {
            if (fileRejections.length > 0) {
              const validExtensions = acceptedFileTypes
                ? Object.keys(acceptedFileTypes)
                    .map((mimeType) =>
                      acceptedFileTypes[mimeType].map((ext) => ext.replace(".", ""))
                    )
                    .flat()
                    .join(", ")
                : "";
              const fileNames = fileRejections
                .map((rejection) => rejection.file.name)
                .join(", ");
              const errorMessage = validExtensions
                ? t("invalidFileType", {
                    files: fileNames,
                    extensions: validExtensions,
                  })
                : t("invalidFileTypeNoExtensions", { files: fileNames });
              toast.error(errorMessage);
            }
          }}
          accept={dropAccept || undefined}
          multiple={multiple}
        >
          {({ getRootProps, getInputProps }) => (
            <>
              <DragArea
                {...getRootProps()}
                src={previewUrl}
                onClose={handleClose}
                renderPreview={renderPreview}
                dragAreaText={dragAreaText}
                multiple={multiple}
                fileCount={multipleFiles.length}
              />
              <input {...getInputProps()} data-testid="file-picker-input" />
            </>
          )}
        </Dropzone>
        {renderMultipleFilesProgress()}
        {onSkip && (
          <Button
            className="w-full mt-4 chat-text rounded-full"
            onClick={() => onSkip()}
            disabled={isLoading}
            data-testid="file-picker-skip-button"
          >
            {isLoading ? "Loading..." : "Skip"}
          </Button>
        )}
        {uploadErrorMsg && (
          <div className="text-red-500 mt-2">{uploadErrorMsg}</div>
        )}
      </div>
    ),
    [
      previewUrl,
      dropAccept,
      fileChangedCallback,
      enableImageCrop,
      onSkip,
      onClose,
      isLoading,
      uploadErrorMsg,
      uploadOptions,
      multiple,
      multipleFiles,
      t,
      acceptedFileTypes,
    ]
  );

  return (
    <div className="w-full" data-testid="file-picker">
      {renderNormalView}
    </div>
  );
}

const DragArea = React.forwardRef<HTMLDivElement, DragAreaProps>(
  (
    {
      src,
      onClose,
      renderPreview,
      dragAreaText,
      multiple,
      fileCount,
      ...props
    },
    ref
  ) => {
    return (
      <div
        {...props}
        ref={ref}
        className="rounded-xl border-4 h-full border-dashed chat-dashed-border flex flex-col justify-center items-center cursor-pointer p-4 relative "
        data-testid="drag-area"
      >
        {src && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute z-10 top-2 right-2 p-2 chat-foreground-color rounded-full shadow-md"
          >
            <XIcon className="w-4 h-4 chat-text" />
          </button>
        )}

        {renderPreview(src)}

        <div className="text-center">
          <p className="font-bold chat-text">{dragAreaText.title}</p>
          <p className="font-bold chat-text">
            {src ? dragAreaText.editAction : dragAreaText.action}
          </p>
          {multiple && (
            <p className="text-sm text-muted-foreground mt-1">
              {fileCount && fileCount > 0
                ? `${fileCount} file${fileCount > 1 ? "s" : ""} selected`
                : "Multiple files supported"}
            </p>
          )}
        </div>
      </div>
    );
  }
);

DragArea.displayName = "DragArea";
