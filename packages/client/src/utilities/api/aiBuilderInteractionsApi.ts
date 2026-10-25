import { zFetch } from "../../lib/utils";
import type { AiBuilderInteraction } from "@zdocs/types";

export interface FetchAiBuilderInteractionsResponse {
  interactions: AiBuilderInteraction[];
}

/**
 * Fetch AI builder interaction logs for a mini app
 */
export async function fetchAiBuilderInteractions(
  orgId: string,
  miniAppId: string
): Promise<AiBuilderInteraction[]> {
  const response = await zFetch(
    `/api/org/${orgId}/mini-apps/${miniAppId}/interactions`,
    {
      method: "POST",
    }
  );

  return response.interactions || [];
}
