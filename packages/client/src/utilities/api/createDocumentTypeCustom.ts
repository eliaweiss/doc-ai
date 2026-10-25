import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";
import { DocumentTypeRecord, SampleDocument, FieldDefinition, LineItemCollectionSchema } from "@zdocs/types";

export interface CreateCustomDocumentTypeParams {
  name: string;
  displayName: string;
  description?: string;
  extractionHint?: string;
  headerSchema?: FieldDefinition[];
  lineItemSchemas?: Record<string, LineItemCollectionSchema> | null;
  sampleDocuments?: SampleDocument[] | null;
  icon?: string;
  color?: string;
}

export async function createDocumentTypeCustom(
  params: CreateCustomDocumentTypeParams
): Promise<DocumentTypeRecord> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/document-types/create-custom`,
    {
      method: "POST",
      body: params,
    }
  );

  return response.documentType;
}

