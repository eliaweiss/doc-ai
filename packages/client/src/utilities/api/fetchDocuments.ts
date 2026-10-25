import { zFetch } from "../../lib/utils";
import { useDocsStore, RECENT_FOLDER_ID } from "../../context-providers/docsStore";
import useOrgStore from "../../context-providers/orgStore";

export const DOCUMENTS_PAGE_SIZE = 50;

interface FetchDocumentsOptions {
  append?: boolean;
  limit?: number;
}

export async function fetchDocuments(options: FetchDocumentsOptions = {}) {
  const { org } = useOrgStore.getState();
  const {
    currentFolderId,
    documents,
    setDocumentsPage,
    setIsLoadingDocuments,
    setIsFetchingMoreDocuments,
  } = useDocsStore.getState();

  if (!org?.id) {
    throw new Error("No organization selected");
  }
  const currentOrgId = org.id;
  const append = options.append ?? false;
  const limit = Math.max(1, options.limit ?? DOCUMENTS_PAGE_SIZE);
  const offset = append ? documents.length : 0;

  if (append) {
    setIsFetchingMoreDocuments(true);
  } else {
    setIsLoadingDocuments(true);
  }

  try {
    const response = await zFetch(
      `/api/org/${currentOrgId}/documents`,
      {
        method: "POST",
        body: {
          folderId: currentFolderId === RECENT_FOLDER_ID ? undefined : currentFolderId,
          sortByUploadDate: currentFolderId === RECENT_FOLDER_ID,
          limit,
          offset,
        },
      }
    );

    const fetchedDocuments = response?.documents || [];
    const total =
      typeof response?.total === "number"
        ? response.total
        : fetchedDocuments.length;
    const hasMore =
      typeof response?.hasMore === "boolean"
        ? response.hasMore
        : offset + fetchedDocuments.length < total;

    setDocumentsPage({
      documents: fetchedDocuments,
      total,
      hasMore,
      append,
    });

    return fetchedDocuments;
  } finally {
    if (append) {
      setIsFetchingMoreDocuments(false);
    } else {
      setIsLoadingDocuments(false);
    }
  }
}
