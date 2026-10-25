import type { ModelProviderResult } from "../../ai/ai-key-provider";
import { resolveExtractionPricingModel } from "./resolve-extraction-pricing-model";

export function logExtractionPricingModel(
  stage: string,
  documentId: string,
  modelResult: ModelProviderResult
) {
  const pricingModel = resolveExtractionPricingModel(modelResult.action);

  console.log(
    `[Extraction] ${stage}: pricingModel=${pricingModel}, envPricingModel=${process.env.NEXT_PUBLIC_PRICING_MODEL ?? "undefined"}, action=${modelResult.action}, model=${modelResult.modelSlug}, documentId=${documentId}`
  );
}
