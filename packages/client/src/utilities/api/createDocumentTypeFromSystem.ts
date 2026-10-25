import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { DocumentTypeRecord } from "@zdocs/types";

export async function createDocumentTypeFromSystem(
  systemTypeName: string
): Promise<DocumentTypeRecord> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/document-types/create-from-system`,
    {
      method: "POST",
      body: { systemTypeName },
    }
  );

  return response.documentType;
}

