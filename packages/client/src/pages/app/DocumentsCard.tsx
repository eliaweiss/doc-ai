"use client";

import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import { FileText, RefreshCw, Trash2 } from "lucide-react";
import type { Organization, Document } from "@zdocs/types";
import { getStatusIcon, formatDate } from "./appPageUtils";

interface DocumentsCardProps {
  org: Organization | null;
  documents: Document[];
  isLoading: boolean;
  onRefresh: () => void;
  onDelete: (documentId: string) => Promise<boolean>;
}

export function DocumentsCard({
  org,
  documents,
  isLoading,
  onRefresh,
  onDelete,
}: DocumentsCardProps) {
  const t = useTranslations("documents");

  const handleDelete = async (documentId: string) => {
    if (window.confirm(t("confirmDelete"))) {
      await onDelete(documentId);
    }
  };

  const getDocumentCountText = (count: number) => {
    return count === 1 ? t("count", { count }) : t("countPlural", { count });
  };

  return (
    <Card className="lg:col-span-1" data-testid="app-docs-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div data-testid="app-docs-header">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("title")}
            </CardTitle>
            <CardDescription>
              {getDocumentCountText(documents.length)}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={!org || isLoading}
            className="text-muted-foreground hover:text-foreground"
            data-testid="app-docs-refresh-btn"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!org ? (
          <p
            className="text-muted-foreground text-sm text-center py-4"
            data-testid="app-docs-no-org"
          >
            {t("selectOrgFirst")}
          </p>
        ) : isLoading ? (
          <div
            className="flex justify-center py-4"
            data-testid="app-docs-loading"
          >
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <p
            className="text-muted-foreground text-sm text-center py-4"
            data-testid="app-docs-empty"
          >
            {t("noDocuments")}
          </p>
        ) : (
          <div
            className="space-y-2 max-h-96 overflow-y-auto"
            data-testid="app-docs-list"
          >
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 bg-secondary rounded-lg border border-border"
                data-testid={`app-doc-item-${doc.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0" data-testid="app-doc-info">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground text-sm font-medium truncate">
                        {doc.fileName || t("untitled")}
                        {doc.fileExtension && `.${doc.fileExtension}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatDate(doc.createdAt)}</span>
                      {doc.docType && (
                        <span className="px-1.5 py-0.5 bg-muted rounded">
                          {doc.docType}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    data-testid="app-doc-actions"
                  >
                    <div
                      className="flex items-center"
                      title={doc.extractionStatus}
                      data-testid="app-doc-status"
                    >
                      {getStatusIcon(doc.extractionStatus)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      data-testid={`app-doc-delete-btn-${doc.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
