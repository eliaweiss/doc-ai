import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";

export interface DryRunDocResult {
  documentId: string;
  fileName: string | null;
  documentDate: string | null;
  fieldResult: unknown;
  logs: Array<{
    level: string;
    message: string;
    fieldPath: string;
  }>;
  notifications: Array<{
    level: string;
    message: string;
    fieldPath?: string;
  }>;
  error?: string;
}

export interface DryRunFormulaParams {
  docTypeName: string;
  fieldName: string;
  code: string;
  fieldType: string;
  collectionKey?: string | null;
}

export async function dryRunFormula(
  params: DryRunFormulaParams
): Promise<DryRunDocResult[]> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  const response = await zFetch(
    `/api/org/${org.id}/document-types/dry-run-formula`,
    {
      method: "POST",
      body: params,
    }
  );

  return response.results;
}
