import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { DenormalizedValues } from "@zdocs/types";



export interface ExtractDocumentDataResponse {
  success: boolean;
  documentId: string;
  docType: string;
  headerData: Record<string, unknown>;
  lineItems:
    | Record<string, unknown>[]
    | Record<string, Record<string, unknown>[]>
    | null;
  denormalized: DenormalizedValues;
  mode: "lambda" | "vercel";
  queued: boolean;
  message: string;
}

export async function extractDocumentData(
  documentId: string,
  forceReExtract?: boolean
): Promise<ExtractDocumentDataResponse> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/documents/${documentId}/extract`,
    { method: "POST", body: { forceReExtract } }
  );

  return response;
}
