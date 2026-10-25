"use client";
/**
 * React hook for handling uiTx postMessage requests from iframes
 *
 * This hook sets up a message listener to handle UI helper requests
 * (toast, confirm, openEntity) from embedded Mini Apps.
 *
 * Usage:
 * ```tsx
 * function MiniAppViewer({ orgId }: { orgId: string }) {
 *   useUiTxMessageHandler(orgId);
 *   return <iframe srcDoc={miniAppHtml} />;
 * }
 * ```
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { UiTxRequest, UiTxResponse, UiTxError } from "@zdocs/types";

interface UiTxMessageHandlerOptions {
  orgId: string;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

/**
 * Handle UI helper requests from iframe
 */
export function useUiTxMessageHandler({
  orgId,
  iframeRef,
}: UiTxMessageHandlerOptions) {
  const router = useRouter();
  const pendingConfirms = useRef<Map<string, (confirmed: boolean) => void>>(
    new Map()
  );

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only handle UITX_REQUEST messages
      if (event.data?.type !== "UITX_REQUEST") {
        return;
      }

      const request: UiTxRequest = event.data.request;
      if (!request) {
        return;
      }

      // Get the iframe source window for responding
      const sourceWindow = event.source as Window;
      if (!sourceWindow) {
        return;
      }

      // Handle UI helpers (client-side only, don't go through API)
      if (request.type.startsWith("ui.")) {
        await handleUIHelper(
          request,
          sourceWindow,
          orgId,
          router,
          pendingConfirms
        );
        return;
      }

      // For data requests, forward to API route
      try {
        const response = await fetch("/api/ui-tx", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...request,
            payload: {
              ...(request.payload && typeof request.payload === "object"
                ? request.payload
                : {}),
              orgId, // Add orgId for session auth
            },
          }),
        });

        const data: UiTxResponse = await response.json();

        // Send response back to iframe
        sourceWindow.postMessage(data, "*");
      } catch (error) {
        // Send error response
        const errorResponse: UiTxResponse = {
          type: "UITX_RESPONSE",
          requestId: request.requestId,
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to process request",
          },
        };
        sourceWindow.postMessage(errorResponse, "*");
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [orgId, router]);
}

/**
 * Handle UI helper requests
 */
async function handleUIHelper(
  request: UiTxRequest,
  sourceWindow: Window,
  orgId: string,
  router: ReturnType<typeof useRouter>,
  pendingConfirms: React.MutableRefObject<
    Map<string, (confirmed: boolean) => void>
  >
) {
  console.log("handleUIHelper", request);
  const { type, payload, requestId } = request;

  const sendResponse = (ok: boolean, result?: unknown, error?: UiTxError) => {
    const response: UiTxResponse = {
      type: "UITX_RESPONSE",
      requestId,
      ok,
      result,
      error,
    };
    sourceWindow.postMessage(response, "*");
  };

  try {
    switch (type) {
      case "ui.toast": {
        // Handle both string payload and object payload formats
        let message: string;
        let level: "info" | "success" | "warning" | "error" = "info";

        if (typeof payload === "string") {
          // Simple string format: payload is the message
          message = payload;
        } else if (payload && typeof payload === "object") {
          // Object format: { message: string, level?: ... }
          message =
            (payload as { message: string; level?: string }).message || "";
          const payloadLevel = (payload as { message: string; level?: string })
            .level;
          if (
            payloadLevel === "success" ||
            payloadLevel === "error" ||
            payloadLevel === "warning"
          ) {
            level = payloadLevel;
          }
        } else {
          sendResponse(false, undefined, {
            code: "VALIDATION_ERROR",
            message: "Invalid payload format for ui.toast",
          });
          return;
        }

        if (!message) {
          sendResponse(false, undefined, {
            code: "VALIDATION_ERROR",
            message: "Message is required for ui.toast",
          });
          return;
        }

        switch (level) {
          case "success":
            toast.success(message);
            break;
          case "error":
            toast.error(message);
            break;
          case "warning":
            toast.warning(message);
            break;
          default:
            toast.info(message);
        }

        sendResponse(true);
        break;
      }

      case "ui.confirm": {
        const {
          title,
          message,
          confirmText = "Confirm",
          cancelText = "Cancel",
        } = payload as {
          title: string;
          message: string;
          confirmText?: string;
          cancelText?: string;
        };

        // Store the resolver for this confirm
        const resolver = (confirmed: boolean) => {
          sendResponse(true, { confirmed });
          pendingConfirms.current.delete(requestId);
        };

        pendingConfirms.current.set(requestId, resolver);

        // Show confirmation dialog
        // Note: This is a simplified implementation
        // In a real app, you'd use a proper dialog component
        const confirmed = window.confirm(`${title}\n\n${message}`);

        if (pendingConfirms.current.has(requestId)) {
          resolver(confirmed);
        }
        break;
      }

      case "ui.openEntity": {
        const { entityId } = payload as { entityId: string };

        if (!entityId) {
          sendResponse(false, undefined, {
            code: "VALIDATION_ERROR",
            message: "entityId is required",
          });
          return;
        }

        // Navigate to entity view
        // Parse entityId to get documentId
        const parts = entityId.split("_");
        const documentId = parts[0];

        window.open(`/document/${documentId}`);
        sendResponse(true);
        break;
      }

      case "ui.openFolder": {
        const { folderId } = payload as { folderId: string };
        if (!folderId) {
          sendResponse(false, undefined, {
            code: "VALIDATION_ERROR",
            message: "folderId is required",
          });
        }
        window.open(`/folder/${folderId}`);
        sendResponse(true);
        break;
      }

      case "ui.uploadToFolder": {
        const { folderId } = payload as { folderId: string };
        if (!folderId) {
          sendResponse(false, undefined, {
            code: "VALIDATION_ERROR",
            message: "folderId is required",
          });
        }
        window.open(`/folder/${folderId}?showUpload=true`);
        sendResponse(true);
        break;
      }

      case "ui.openDocument": {
        const { documentId } = payload as { documentId: string };

        if (!documentId) {
          sendResponse(false, undefined, {
            code: "VALIDATION_ERROR",
            message: "documentId is required",
          });
          return;
        }

        // Navigate to document view
        router.push(`/${orgId}/documents/${documentId}`);
        sendResponse(true);
        break;
      }

      default:
        sendResponse(false, undefined, {
          code: "UNSUPPORTED",
          message: `Unknown UI helper: ${type}`,
        });
    }
  } catch (error) {
    console.error(`Error handling UI helper ${type}:`, error);
    sendResponse(false, undefined, {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
