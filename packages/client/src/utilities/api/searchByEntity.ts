import { zFetch } from "../../lib/utils";
import type { EntityResponseList, EntitySearchRequest } from "@zdocs/types";

/**
 * Search for a specific entity type (document header or line item collection)
 * Returns results with the schema for dynamic column generation
 */
export async function searchByEntityApi(
  orgId: string,
  request: EntitySearchRequest
): Promise<EntityResponseList> {
  return zFetch(`/api/org/${orgId}/search/entity`, {
    method: "POST",
    body: request as unknown as Record<string, unknown>,
  });
}
