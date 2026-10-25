"use client";
import { create } from "zustand";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "complete"
  | "partial"
  | "failed";

export interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: UploadStatus;
  uploadProgress: number; // 0-100
  extractionProgress: number; // 0-100
  documentId?: string;
  error?: string;
  addedAt: number;
}

interface UploadStore {
  items: UploadItem[];
  isExpanded: boolean;
  isPanelVisible: boolean;

  // Actions
  addUpload: (file: File) => string;
  updateUploadProgress: (id: string, progress: number) => void;
  setUploadComplete: (id: string, documentId: string) => void;
  updateExtractionProgress: (id: string, progress: number) => void;
  setComplete: (id: string) => void;
  setPartial: (id: string) => void;
  setFailed: (id: string, error?: string) => void;
  removeItem: (id: string) => void;
  removeItemByDocumentId: (documentId: string) => void;
  clearCompleted: () => void;
  toggleExpanded: () => void;
  showPanel: () => void;
  hidePanel: () => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  items: [],
  isExpanded: true,
  isPanelVisible: false,

  addUpload: (file: File) => {
    const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newItem: UploadItem = {
      id,
      fileName: file.name,
      fileSize: file.size,
      status: "queued",
      uploadProgress: 0,
      extractionProgress: 0,
      addedAt: Date.now(),
    };
    set((state) => ({
      items: [...state.items, newItem],
      isPanelVisible: true,
    }));
    return id;
  },

  updateUploadProgress: (id: string, progress: number) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "uploading" as UploadStatus,
              uploadProgress: progress,
            }
          : item
      ),
    }));
  },

  setUploadComplete: (id: string, documentId: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "processing" as UploadStatus,
              uploadProgress: 100,
              documentId,
            }
          : item
      ),
    }));
  },

  updateExtractionProgress: (id: string, progress: number) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, extractionProgress: progress } : item
      ),
    }));
  },

  setComplete: (id: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "complete" as UploadStatus,
              extractionProgress: 100,
            }
          : item
      ),
    }));
  },

  setPartial: (id: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, status: "partial" as UploadStatus } : item
      ),
    }));
  },

  setFailed: (id: string, error?: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, status: "failed" as UploadStatus, error }
          : item
      ),
    }));
  },

  removeItem: (id: string) => {
    set((state) => {
      const newItems = state.items.filter((item) => item.id !== id);
      return {
        items: newItems,
        isPanelVisible: newItems.length > 0 ? state.isPanelVisible : false,
      };
    });
  },

  removeItemByDocumentId: (documentId: string) => {
    set((state) => {
      const newItems = state.items.filter(
        (item) => item.documentId !== documentId
      );
      return {
        items: newItems,
        isPanelVisible: newItems.length > 0 ? state.isPanelVisible : false,
      };
    });
  },

  clearCompleted: () => {
    set((state) => {
      const newItems = state.items.filter(
        (item) => item.status !== "complete" && item.status !== "partial"
      );
      return {
        items: newItems,
        isPanelVisible: newItems.length > 0 ? state.isPanelVisible : false,
      };
    });
  },

  toggleExpanded: () => {
    set((state) => ({ isExpanded: !state.isExpanded }));
  },

  showPanel: () => {
    set({ isPanelVisible: true });
  },

  hidePanel: () => {
    set({ isPanelVisible: false });
  },
}));
