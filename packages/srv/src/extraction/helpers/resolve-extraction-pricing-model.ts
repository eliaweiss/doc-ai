import type { ModelProviderResult } from "../../ai/ai-key-provider";

export function resolveExtractionPricingModel(
  action: ModelProviderResult["action"]
): "per_page" | "per_token" {
  if (
    process.env.NEXT_PUBLIC_PRICING_MODEL === "per_page" ||
    action === "EXTRACT_DOCUMENT_LITE"
  ) {
    return "per_page";
  }

  return "per_token";
}
