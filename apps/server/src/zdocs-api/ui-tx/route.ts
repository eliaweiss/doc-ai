import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/app/session-auth/auth-config";
import { handleUiTxRequest, type UiTxContext } from "@zdocs/srv";
import { userCanAccessOrgId } from "@/app/api/org/functions/userCanAccessOrgId";
import type { UiTxRequest, UiTxResponse } from "@zdocs/types";

/**
 * Create error response helper
 */
function errorResponse(
  requestId: string,
  code: "PERMISSION_DENIED" | "RATE_LIMITED" | "INTERNAL_ERROR",
  message: string,
  status: number
): NextResponse {
  return NextResponse.json(
    {
      type: "UITX_RESPONSE",
      requestId,
      ok: false,
      error: { code, message },
    } as UiTxResponse,
    { status }
  );
}

/**
 * POST /api/ui-tx
 *
 * Main endpoint for uiTx SDK requests.
 * doc-ai: session-based (iframe mode) only - orgId REQUIRED in payload.
 * API keys don't exist locally, so the API key branch is removed.
 */
export async function POST(req: NextRequest) {
  let requestId = "";

  try {
    // Parse request first to get requestId for error responses
    const request: UiTxRequest = await req.json();
    requestId = request.requestId || "";

    const session = await getServerSession(authConfig);

    if (!session?.user?.id) {
      return errorResponse(
        requestId,
        "PERMISSION_DENIED",
        "Authentication required",
        401
      );
    }

    // Session auth: orgId REQUIRED in payload
    const orgId = (request.payload as { orgId?: string })?.orgId;
    if (!orgId) {
      return errorResponse(
        requestId,
        "PERMISSION_DENIED",
        "orgId is required in request payload for session auth",
        400
      );
    }

    // Verify user can access the org
    if (!(await userCanAccessOrgId(orgId, session))) {
      return errorResponse(
        requestId,
        "PERMISSION_DENIED",
        "User does not have access to this organization",
        403
      );
    }

    const context: UiTxContext = {
      orgId,
      authMethod: "session",
    };

    // UI helpers are handled client-side in embedded mode, not through API
    if (request.type.startsWith("ui.")) {
      return NextResponse.json(
        {
          type: "UITX_RESPONSE",
          requestId: request.requestId,
          ok: false,
          error: {
            code: "UNSUPPORTED",
            message: "UI helpers are only available in embedded mode",
          },
        } as UiTxResponse,
        { status: 400 }
      );
    }

    // Delegate to srv handler
    const response = await handleUiTxRequest(request, context);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in ui-tx endpoint:", error);
    return errorResponse(
      requestId,
      "INTERNAL_ERROR",
      "Failed to process request",
      500
    );
  }
}
