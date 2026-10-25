"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ImageCanvas } from "../../../components/ui/image-canvas";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface DocumentImagePaneProps {
  documentId: string;
  fileName: string | null;
  contentType: string;
}

export function DocumentImagePane({
  documentId,
  fileName,
  contentType,
}: DocumentImagePaneProps) {
  const t = useTranslations("documentPage");
  const { logEvent } = useLogUserJourneyEvent();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageUrl = `/api/uploads/${documentId}/${encodeURIComponent(
    fileName || "document"
  )}`;

  const isPdf = contentType === "application/pdf";
  const isImage = contentType.startsWith("image/");

  return (
    <div
      className="h-full flex flex-col bg-muted/30"
      data-testid="document-image-pane"
    >
      {/* Content */}
      <div
        className="flex-1 overflow-hidden"
        data-testid="document-image-content"
      >
        {isPdf ? (
          <iframe
            src={imageUrl}
            className="w-full h-full border-0 bg-white"
            title={fileName || "Document"}
            data-testid="document-pdf-viewer"
          />
        ) : isImage ? (
          <>
            {/* {isLoading && !hasError && (
              <div
                className="absolute inset-0 flex items-center justify-center z-10"
                data-testid="document-image-loading"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
              </div>
            )} */}
            {hasError ? (
              <div
                className="h-full flex items-center justify-center text-muted-foreground p-8"
                data-testid="document-image-error"
              >
                <p>{t("errorLoadingImage")}</p>
              </div>
            ) : (
              <ImageCanvas
                src={imageUrl}
                alt={fileName || "Document"}
                showToolbar={true}
                showRotate={true}
                className="h-full"
                documentId={documentId}
                onLoad={() => {
                  setIsLoading(false);
                  logEvent({
                    eventType: "document_image_loaded",
                    eventData: {
                      documentId,
                      contentType,
                    },
                  });
                }}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                  logEvent({
                    eventType: "document_image_error",
                    eventData: {
                      documentId,
                      contentType,
                    },
                  });
                }}
                onZoomIn={() => {
                  logEvent({
                    eventType: "document_image_zoom_in",
                    eventData: {
                      documentId,
                    },
                  });
                }}
                onZoomOut={() => {
                  logEvent({
                    eventType: "document_image_zoom_out",
                    eventData: {
                      documentId,
                    },
                  });
                }}
                onRotate={() => {
                  logEvent({
                    eventType: "document_image_rotate",
                    eventData: {
                      documentId,
                    },
                  });
                }}
                onFitToWidth={() => {
                  logEvent({
                    eventType: "document_image_fit_to_width",
                    eventData: {
                      documentId,
                    },
                  });
                }}
              />
            )}
          </>
        ) : (
          <div
            className="h-full flex flex-col items-center justify-center text-muted-foreground p-8"
            data-testid="document-unsupported"
          >
            <p>{t("unsupportedFormat")}</p>
            <p className="text-sm mt-2">{contentType}</p>
          </div>
        )}
      </div>
    </div>
  );
}
