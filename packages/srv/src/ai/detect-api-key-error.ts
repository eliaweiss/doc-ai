/**
 * Detects if an error from the AI SDK indicates an API key issue
 * and converts it to an AiKeyError with user-friendly messages.
 * 
 * Common error patterns:
 * - Google: "API key not valid", "API_KEY_INVALID", statusCode 400
 * - OpenAI: "Incorrect API key", "invalid_api_key", statusCode 401
 * - Anthropic: "Invalid API key", statusCode 401
 */
export class AiKeyError extends Error {
  constructor(
    message: string,
    public readonly code: "NO_KEY" | "INVALID_KEY" | "QUOTA_EXCEEDED"
  ) {
    super(message);
    this.name = "AiKeyError";
  }
}

export function detectAndConvertApiKeyError(error: unknown): AiKeyError | null {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "";

  // Check error name (AI SDK uses AI_APICallError)
  if (errorName === "AI_APICallError" || errorName.includes("APICallError")) {
    // Check for API key invalid errors
    if (
      errorMessage.includes("API key not valid") ||
      errorMessage.includes("API key is invalid") ||
      errorMessage.includes("invalid API key") ||
      errorMessage.includes("Incorrect API key") ||
      errorMessage.includes("API_KEY_INVALID") ||
      errorMessage.includes("invalid_api_key")
    ) {
      return new AiKeyError(
        "The AI API key configured for your organization is invalid. Please contact your organization administrator or customer support.",
        "INVALID_KEY"
      );
    }

    // Check for quota exceeded errors
    if (
      errorMessage.includes("quota") ||
      errorMessage.includes("QUOTA_EXCEEDED") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("rate limit")
    ) {
      return new AiKeyError(
        "AI API quota exceeded. Please contact your organization administrator or customer support.",
        "QUOTA_EXCEEDED"
      );
    }

    // Check status code for 401 (unauthorized) - likely invalid key
    const errorObj = error as { statusCode?: number };
    if (errorObj.statusCode === 401) {
      return new AiKeyError(
        "The AI API key configured for your organization is invalid. Please contact your organization administrator or customer support.",
        "INVALID_KEY"
      );
    }
  }

  // Also check generic error messages
  if (
    errorMessage.includes("API key not valid") ||
    errorMessage.includes("API key is invalid") ||
    errorMessage.includes("invalid API key")
  ) {
    return new AiKeyError(
      "The AI API key configured for your organization is invalid. Please contact your organization administrator or customer support.",
      "INVALID_KEY"
    );
  }

  return null;
}
