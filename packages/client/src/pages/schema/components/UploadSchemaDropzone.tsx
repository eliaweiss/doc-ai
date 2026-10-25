"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { FileJson, Upload } from "lucide-react";
import { useDropzone } from "react-dropzone";

interface UploadSchemaDropzoneProps {
  fileName: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
}

export function UploadSchemaDropzone({
  fileName,
  disabled,
  onFile,
}: UploadSchemaDropzoneProps) {
  const t = useTranslations("schema");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        onFile(file);
      }
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"] },
    maxFiles: 1,
    multiple: false,
    disabled,
  });

  return (
    <div className="space-y-2" data-testid="upload-schema-dropzone-section">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        data-testid="upload-schema-dropzone"
      >
        <input {...getInputProps()} data-testid="upload-schema-file-input" />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-foreground">
          {isDragActive ? t("dropFilesHere") : t("dropSchemaFileOrClick")}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("jsonFilesOnly")}
        </p>
      </div>

      {fileName && (
        <div
          className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2"
          data-testid="upload-schema-selected-file"
        >
          <FileJson className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate">
            {t("schemaFileSelected", { name: fileName })}
          </span>
        </div>
      )}
    </div>
  );
}
