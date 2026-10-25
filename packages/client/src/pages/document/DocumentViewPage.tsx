"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { AppHeader } from "../app/AppHeader";
import { DocumentBreadcrumb } from "./components/DocumentBreadcrumb";
import { DocumentImagePane } from "./components/DocumentImagePane";
import { DocumentDataPane } from "./components/DocumentDataPane";
import { ResizableSplitPane } from "../../components/ui/resizable-split-pane";
import { DocumentViewProvider } from "../../context-providers/DocumentViewProvider";
import { useDocumentViewStore } from "../../context-providers/documentViewStore";
import { AppAuthView } from "../app/AppAuthView";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";

interface DocumentViewPageProps {
  documentId: string;
}

function DocumentViewPageContent() {
  const t = useTranslations("documentPage");
  const { document, folderPath, isLoading, error } = useDocumentViewStore();
  const { logEvent } = useLogUserJourneyEvent();
  const isPdf = document?.contentType === "application/pdf";
  const isImage = document?.contentType?.startsWith("image/");
  const showSinglePane = !isPdf && !isImage;
  // console.log("document", document);

  // Log page view when document loads successfully
  useEffect(() => {
    if (document && !isLoading && !error) {
      logEvent({
        eventType: "document_page_viewed",
        eventData: {
          documentId: document.id,
          docType: document.docType,
          contentType: document.contentType,
          extractionStatus: document.extractionStatus,
        },
      });
    }
  }, [document?.id, isLoading, error, logEvent]);
  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center bg-background h-full"
        data-testid="document-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div
        className="flex-1 flex items-center justify-center bg-background"
        data-testid="document-error"
      >
        <div className="text-center">
          <p className="text-lg text-destructive">
            {error || t("documentNotFound")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      data-testid="document-view-content"
    >
      {/* Breadcrumb */}
      <div
        className="px-6 py-4 border-b border-border bg-card flex-shrink-0"
        data-testid="document-view-breadcrumb"
      >
        <DocumentBreadcrumb
          folderPath={folderPath}
          documentName={document.fileName || t("untitled")}
        />
      </div>

      {/* Split Pane Content */}
      <div className="flex-1 min-h-0">
        {!showSinglePane ? (
          <ResizableSplitPane
            leftPane={<DocumentDataPane />}
            rightPane={
              <DocumentImagePane
                documentId={document.id}
                fileName={document.fileName}
                contentType={document.contentType}
              />
            }
            initialLeftWidthPercent={50}
            minLeftWidthPercent={25}
            maxLeftWidthPercent={75}
            storageKey="document-view"
          />
        ) : (
          <DocumentDataPane />
        )}
      </div>
    </div>
  );
}

export function DocumentViewPage({ documentId }: DocumentViewPageProps) {
  const { status } = useSession();

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="document-page-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Not authenticated - show login/register
  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  // Authenticated - show document view
  return (
    <DocumentViewProvider documentId={documentId}>
      <div
        className="h-screen bg-background flex flex-col"
        data-testid="document-page-main"
      >
        <AppHeader />

        <main
          className="flex-1 min-h-0 overflow-hidden"
          data-testid="document-page-content"
        >
          <DocumentViewPageContent />
        </main>
      </div>
    </DocumentViewProvider>
  );
}

export default DocumentViewPage;
