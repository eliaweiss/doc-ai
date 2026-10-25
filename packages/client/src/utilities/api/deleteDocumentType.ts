import { zFetch } from "../../lib/utils";
import useOrgStore from "../../context-providers/orgStore";

export async function deleteDocumentType(typeId: string): Promise<void> {
  const { org } = useOrgStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }

  await zFetch(
    `/api/org/${org.id}/document-types/${typeId}/delete`,
    {
      method: "POST",
    }
  );
}

