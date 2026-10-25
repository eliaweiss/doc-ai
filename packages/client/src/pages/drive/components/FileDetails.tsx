"use client";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { useDocsStore, RECENT_FOLDER_ID } from "../../../context-providers/docsStore";
import { cn } from "@zdocs/util";
import FolderPath from "./FolderPath";
import { DocumentsGrid } from "./DocumentsGrid";
import { fetchDocuments } from "../../../utilities/api/fetchDocuments";
import FetchMoreButton from "./FetchMoreButton";

export default function FileDetails() {
  const t = useTranslations("drive");
  const {
    documents,
    documentsTotal,
    documentsHasMore,
    folderPath,
    currentFolderId,
    isLoadingDocuments,
    isFetchingMoreDocuments,
  } = useDocsStore();
  const isRecentView = currentFolderId === RECENT_FOLDER_ID;

  const handleFetchMore = () => {
    fetchDocuments({ append: true }).catch((error) => {
      console.error("Error fetching more documents:", error);
    });
  };

  return (
    <div className="h-full min-h-0 flex flex-col " data-testid="file-details">
      {/* Breadcrumb / Recent header */}
      {/* On mobile, add left padding to avoid hamburger button overlap */}
      <div className={cn("flex items-center min-h-16 p-2 border-b border-border", "md:pl-4 pl-16")} data-testid="file-details-header">
        {isRecentView ? (
          <div className="flex items-center gap-2" data-testid="recent-view-header">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <span className="text-lg font-semibold text-foreground">{t("recent")}</span>
          </div>
        ) : (
          <FolderPath folderPath={folderPath} />
        )}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
        {isLoadingDocuments ? (
          <div
            className="px-6 py-12 text-center text-muted-foreground"
            data-testid="loading-documents"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-2" />
            {t("loading")}
          </div>
        ) : documents?.length > 0 ? (
          <div className="flex flex-col flex-1 min-h-0">
            <DocumentsGrid documents={documents} />

            {documentsHasMore && (
              <FetchMoreButton
                remaining={documentsTotal - documents.length}
                isFetching={isFetchingMoreDocuments}
                onFetchMore={handleFetchMore}
              />
            )}
          </div>
        ) : (
          <div
            className="px-6 py-12 text-center text-muted-foreground"
            data-testid="no-documents-message"
          >
            {t("noDocuments")}
          </div>
        )}
      </div>
    </div>
  );
}
