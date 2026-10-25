import { zFetch } from "../../lib/utils";
import { Document, DocumentNotification } from "@zdocs/types";
import { FieldDefinition, LineItemCollectionSchema } from "@zdocs/types";
import useOrgStore from "../../context-providers/orgStore";

export interface DocumentDataResponse {
  headerData: Record<string, unknown> | null;
  lineItems:
    | Record<string, unknown>[]
    | Record<string, Record<string, unknown>[]>
    | null;
  totalAmount: string | null;
  documentDate: string | null;
  dueDate: string | null;
  notifications?: DocumentNotification[] | null;
}

export interface DocumentTypeResponse {
  id: string;
  name: string;
  displayName: string | null;
  headerSchema: FieldDefinition[];
  lineItemSchemas: Record<string, LineItemCollectionSchema> | null;
}

export interface ChangeDocumentTypeRequest {
  docType: string | null;
}

export interface ChangeDocumentTypeResponse {
  document: Document;
  documentType: DocumentTypeResponse | null;
  documentData: DocumentDataResponse | null;
}

export async function changeDocumentType(
  documentId: string,
  docType: string | null
): Promise<ChangeDocumentTypeResponse> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/documents/${documentId}/change-type`,
    {
      method: "POST",
      body: { docType },
    }
  );

  return response;
}
