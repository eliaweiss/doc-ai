/**
 * Main request router for uiTx SDK
 *
 * doc-ai: used by /api/ui-tx (mini apps); the MCP server calls the handlers
 * directly. Reconciliation methods are v2 and removed.
 */

import type { UiTxRequest, UiTxResponse, UiTxError } from "@zdocs/types";
import { handleGetSession } from "./handlers/getSession";
import { handleSearchEntities } from "./handlers/searchEntities";
import { handleGetEntity } from "./handlers/getEntity";
import { handleListDocuments } from "./handlers/listDocuments";
import { handleAggregate } from "./handlers/aggregate";
import { handleUpdateEntityFields } from "./handlers/updateEntityFields";

/**
 * Context for uiTx request handling
 * Populated by the API route after authentication
 *
 * Note: User data (userId, userEmail) is NOT passed to handlers.
 * Handlers only need orgId for data access.
 */
export interface UiTxContext {
  orgId: string; // Already validated by route
  authMethod: "session" | "api_key";
}

/**
 * Route uiTx request to appropriate handler
 */
export async function handleUiTxRequest(
  request: UiTxRequest,
  context: UiTxContext
): Promise<UiTxResponse> {
  const { type, payload, requestId } = request;

  let result: unknown;
  let error: UiTxError | undefined;

  try {
    // Payload type is unknown, handlers will validate their own params
    const params = payload as any;

    switch (type) {
      case "getSession":
        result = await handleGetSession(context, params);
        break;

      case "searchEntities":
        result = await handleSearchEntities(context, params);
        break;

      case "getEntity":
        result = await handleGetEntity(context, params);
        break;

      case "listDocuments":
        result = await handleListDocuments(context, params);
        break;

      case "aggregate":
        result = await handleAggregate(context, params);
        break;

      case "updateEntityFields":
        result = await handleUpdateEntityFields(context, params);
        break;

      default:
        error = {
          code: "UNSUPPORTED",
          message: `Unknown method: ${type}`,
        };
    }
  } catch (handlerError) {
    console.error(`Error in ${type} handler:`, handlerError);

    // Map known error messages to appropriate error codes
    const errorMessage =
      handlerError instanceof Error ? handlerError.message : "Handler error";

    let errorCode: UiTxError["code"] = "INTERNAL_ERROR";
    if (errorMessage.includes("not found")) {
      errorCode = "NOT_FOUND";
    } else if (errorMessage.includes("Unauthorized")) {
      errorCode = "PERMISSION_DENIED";
    } else if (errorMessage.includes("required")) {
      errorCode = "VALIDATION_ERROR";
    }

    error = {
      code: errorCode,
      message: errorMessage,
    };
  }

  return {
    type: "UITX_RESPONSE",
    requestId,
    ok: !error,
    result: error ? undefined : result,
    error,
  };
}
