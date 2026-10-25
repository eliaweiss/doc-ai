import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { DocumentTypeRecord, FieldDefinition, LineItemCollectionSchema } from "@zdocs/types";

export interface UpdateDocumentTypeData {
  displayName?: string | null;
  description?: string | null;
  extractionHint?: string | null;
  headerSchema?: FieldDefinition[];
  lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
  icon?: string | null;
  color?: string | null;
  isDataset?: boolean;
  defaultFolderId?: string | null;
}

export async function updateDocumentType(
  typeId: string,
  data: UpdateDocumentTypeData
): Promise<DocumentTypeRecord> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/document-types/${typeId}/update`,
    {
      method: "POST",
      body: data,
    }
  );

  return response.documentType;
}

