import { create } from "zustand";
import { Document, Folder } from "@zdocs/types";
import {
  fetchDocument,
  DocumentDataResponse,
  DocumentTypeResponse,
} from "../utilities/api/fetchDocument";

interface DocumentViewState {
  // Data
  document: Document | null;
  documentData: DocumentDataResponse | null;
  documentType: DocumentTypeResponse | null;
  folderPath: Folder[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Current document ID being viewed
  documentId: string | null;
}

interface DocumentViewActions {
  loadDocument: (documentId: string) => Promise<void>;
  setDocument: (document: Document) => void;
  setDocumentData: (data: DocumentDataResponse | null) => void;
  setDocumentType: (documentType: DocumentTypeResponse | null) => void;
  reset: () => void;
  getFolderId: () => string | null;
}

type DocumentViewStore = DocumentViewState & DocumentViewActions;

const initialState: DocumentViewState = {
  document: null,
  documentData: null,
  documentType: null,
  folderPath: [],
  isLoading: true,
  error: null,
  documentId: null,
};

export const useDocumentViewStore = create<DocumentViewStore>((set, get) => ({
  ...initialState,

  loadDocument: async (documentId: string) => {
    // Skip if already loading this document
    if (get().documentId === documentId && get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null, documentId });

    try {
      const response = await fetchDocument(documentId);
      set({
        document: response.document,
        documentData: response.documentData,
        documentType: response.documentType,
        folderPath: response.folderPath,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error("Error loading document:", err);
      set({
        isLoading: false,
        error: "Failed to load document",
        document: null,
        documentData: null,
        documentType: null,
        folderPath: [],
      });
    }
  },

  setDocument: (document: Document) => set({ document }),

  setDocumentData: (data: DocumentDataResponse | null) =>
    set({ documentData: data }),

  setDocumentType: (documentType: DocumentTypeResponse | null) =>
    set({ documentType }),

  getFolderId: () => get().folderPath[get().folderPath.length - 1]?.id || null,

  reset: () => set(initialState),
}));
