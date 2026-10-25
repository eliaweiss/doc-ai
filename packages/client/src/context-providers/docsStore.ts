import { Folder, Document, ExtractionStatus } from "@zdocs/types";
import { create } from "zustand";
import { FolderNode } from "../pages/drive/types/folder-node";

export const RECENT_FOLDER_ID = "__recent__";

interface DocsStore {
  // Documents
  documents: Document[];
  documentsTotal: number;
  documentsHasMore: boolean;
  setDocuments: (documents: Document[]) => void;
  setDocumentsPage: (params: {
    documents: Document[];
    total: number;
    hasMore: boolean;
    append?: boolean;
  }) => void;
  removeDocument: (documentId: string) => void;
  addDocument: (document: Document) => void;
  updateDocumentStatuses: (
    statuses: Array<{ id: string; extractionStatus: string }>
  ) => void;

  // Current folder
  currentFolderId: string | null;
  setCurrentFolderId: (folderId: string | null) => void;

  // Folder tree
  folderTree: FolderNode[];
  setFolderTree: (folderTree: FolderNode[]) => void;

  // Current document
  currentDocumentId: string | null;
  setCurrentDocumentId: (documentId: string | null) => void;

  currentDocument: Document | null;
  setCurrentDocument: (document: Document | null) => void;

  // Folder path (breadcrumb)
  folderPath: Folder[];
  setFolderPath: (folderPath: Folder[]) => void;

  // Loading states
  isSaving: boolean;
  setIsSaving: (isSaving: boolean) => void;

  isLoadingDocuments: boolean;
  setIsLoadingDocuments: (isLoading: boolean) => void;

  isFetchingMoreDocuments: boolean;
  setIsFetchingMoreDocuments: (isLoading: boolean) => void;

  isLoadingFolders: boolean;
  setIsLoadingFolders: (isLoading: boolean) => void;

  showUploadOnInit: boolean;
  setShowUploadOnInit: (showUploadOnInit: boolean) => void;

  isUploadModalOpen: boolean;
  setIsUploadModalOpen: (isOpen: boolean) => void;
}

export const useDocsStore = create<DocsStore>((set, get) => ({
  // Documents
  documents: [],
  documentsTotal: 0,
  documentsHasMore: false,
  setDocuments: (documents) =>
    set({
      documents,
      documentsTotal: documents.length,
      documentsHasMore: false,
    }),
  setDocumentsPage: ({ documents, total, hasMore, append = false }) =>
    set((state) => ({
      documents: append ? [...state.documents, ...documents] : documents,
      documentsTotal: total,
      documentsHasMore: hasMore,
    })),
  removeDocument: (documentId) => {
    const { documents, documentsTotal } = get();
    set({
      documents: documents.filter((d) => d.id !== documentId),
      documentsTotal: Math.max(0, documentsTotal - 1),
    });
  },
  addDocument: (document) => {
    const { documents, documentsTotal } = get();
    set({
      documents: [...documents, document],
      documentsTotal: documentsTotal + 1,
    });
  },
  updateDocumentStatuses: (statuses) => {
    const { documents } = get();
    const statusMap = new Map(statuses.map((s) => [s.id, s.extractionStatus]));
    const updatedDocuments = documents.map((doc) => {
      const newStatus = statusMap.get(doc.id);
      if (newStatus) {
        return { ...doc, extractionStatus: newStatus as ExtractionStatus };
      }
      return doc;
    });
    set({ documents: updatedDocuments });
  },

  // Folder tree
  folderTree: [],
  setFolderTree: (folderTree) => set({ folderTree }),

  // Current folder
  currentFolderId: null,
  setCurrentFolderId: (folderId) => set({ currentFolderId: folderId }),

  // Current document
  currentDocumentId: null,
  setCurrentDocumentId: (documentId) => set({ currentDocumentId: documentId }),

  currentDocument: null,
  setCurrentDocument: (document) => set({ currentDocument: document }),

  // Folder path
  folderPath: [],
  setFolderPath: (folderPath) => set({ folderPath }),

  // Loading states
  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),

  isLoadingDocuments: false,
  setIsLoadingDocuments: (isLoading) => set({ isLoadingDocuments: isLoading }),

  isFetchingMoreDocuments: false,
  setIsFetchingMoreDocuments: (isLoading) =>
    set({ isFetchingMoreDocuments: isLoading }),

  isLoadingFolders: false,
  setIsLoadingFolders: (isLoading) => set({ isLoadingFolders: isLoading }),

  showUploadOnInit: false,
  setShowUploadOnInit: (showUploadOnInit) => set({ showUploadOnInit: showUploadOnInit }),

  isUploadModalOpen: false,
  setIsUploadModalOpen: (isOpen) => set({ isUploadModalOpen: isOpen }),
}));
