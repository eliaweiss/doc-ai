import { zFetch } from "../../lib/utils";

export interface ToggleLineItemDuplicateResponse {
  success: boolean;
  entityId: string;
  isDuplicate: boolean;
}

/**
 * Mark or unmark a line item as a duplicate.
 * Updates both the line item JSONB in document_data and the search_index row.
 */
export async function toggleLineItemDuplicateApi(
  orgId: string,
  documentId: string,
  entityId: string,
  isDuplicate: boolean
): Promise<ToggleLineItemDuplicateResponse> {
  return zFetch(
    `/api/org/${orgId}/documents/${documentId}/toggle-duplicate`,
    {
      method: "POST",
      body: { entityId, isDuplicate },
    }
  );
}
