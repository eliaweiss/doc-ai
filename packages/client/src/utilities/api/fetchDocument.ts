import { zFetch } from "../../lib/utils";
import {
  Document,
  Folder,
  FieldDefinition,
  LineItemCollectionSchema,
  DocumentNotification,
} from "@zdocs/types";
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

export interface FetchDocumentResponse {
  document: Document;
  documentData: DocumentDataResponse | null;
  documentType: DocumentTypeResponse | null;
  folderPath: Folder[];
}

export async function fetchDocument(
  documentId: string
): Promise<FetchDocumentResponse> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/documents/${documentId}`,
    { method: "POST" }
  );

  return response;
}
