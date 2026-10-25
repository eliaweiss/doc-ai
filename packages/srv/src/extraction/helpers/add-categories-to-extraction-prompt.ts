import type { AdditionalCategoryPrompt } from "../category-mapping-service";

export function addCategoriesToExtractionPrompt(
  prompt: string,
  additionalCategoryPrompt: AdditionalCategoryPrompt
) {
  if (additionalCategoryPrompt.enumCategoryValues.length === 0) {
    return prompt;
  }

  prompt += `\n\n`;
  prompt += `Category assignment instructions:\n`;
  prompt += `- Add a "category" value for every extracted line item.\n`;
  prompt += `- Use one of the available categories below.\n`;
  prompt += `- Always assign a category. If none is a close fit, use the miscellaneous/other category (e.g. שונות).\n`;
  prompt += `- Do not leave category null or empty.\n\n`;
  prompt += `Available categories:\n`;
  prompt += `${additionalCategoryPrompt.categoryTextList}\n\n`;
  return prompt;
}
