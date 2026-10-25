import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { DocumentTypeRecord } from "@zdocs/types";

export interface FetchDocumentTypesResponse {
  documentTypes: DocumentTypeRecord[];
  total: number;
}

export interface FetchDocumentTypesOptions {
  includeDatasets?: boolean;
}

export async function fetchDocumentTypes(
  options: FetchDocumentTypesOptions = {}
): Promise<DocumentTypeRecord[]> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  console.log("fetchDocumentTypes options", options);

  const response = await zFetch(
    `/api/org/${org.id}/document-types`,
    {
      method: "POST",
      body: {
        includeDatasets: options.includeDatasets,
      },
    }
  );

  return response.documentTypes;
}
