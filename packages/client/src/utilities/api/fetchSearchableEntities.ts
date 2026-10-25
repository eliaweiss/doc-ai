import { zFetch } from "../../lib/utils";
import type { SearchableEntityOption } from "@zdocs/types";

export interface FetchSearchableEntitiesResponse {
  entities: SearchableEntityOption[];
}

/**
 * Fetch all searchable entities for an organization
 * Returns document headers and line item collections that can be searched
 */
export async function fetchSearchableEntities(
  orgId: string
): Promise<SearchableEntityOption[]> {
  const response = await zFetch(
    `/api/org/${orgId}/search/searchable-entities`
  );
  return response.entities;
}
