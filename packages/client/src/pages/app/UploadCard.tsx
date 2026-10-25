"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import { FilePicker } from "../../components/ui/file-picker/FilePicker";
import { DropAccept } from "../../utilities/handleClientUpload";
import { Upload, CheckCircle } from "lucide-react";
import type { Organization } from "@zdocs/types";

interface UploadCardProps {
  org: Organization | null;
  isUploading: boolean;
  setIsUploading: (loading: boolean) => void;
  uploadSuccess: boolean;
  onUploadComplete: (url: string, file: File) => void;
}

export function UploadCard({
  org,
  isUploading,
  setIsUploading,
  uploadSuccess,
  onUploadComplete,
}: UploadCardProps) {
  const t = useTranslations("upload");

  return (
    <Card data-testid="app-upload-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!org ? (
          <p
            className="text-muted-foreground text-sm text-center py-4"
            data-testid="app-upload-no-org"
          >
            {t("selectOrgFirst")}
          </p>
        ) : (
          <div data-testid="app-upload-picker">
            {uploadSuccess && (
              <div
                className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-600 dark:text-green-400 flex items-center gap-2"
                data-testid="app-upload-success"
              >
                <CheckCircle className="w-4 h-4" />
                {t("success")}
              </div>
            )}
            <FilePicker
              onSave={onUploadComplete}
              multiple={true}
              isLoading={isUploading}
              setIsLoading={setIsUploading}
              acceptedFileTypes={{
                ...DropAccept.documents,
                ...DropAccept.images,
              }}
              dragAreaText={{
                title: t("dropHere"),
                action: t("clickToBrowse"),
                editAction: t("clickToReplace"),
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
