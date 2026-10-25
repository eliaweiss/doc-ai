"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  DocumentTypeRecord,
  FieldDefinition,
  FolderMapping,
  LineItemCollectionSchema,
} from "@zdocs/types";
import useOrgStore from "../../../context-providers/orgStore";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { fetchDocumentTypes } from "../../../utilities/api/fetchDocumentTypes";
import {
  updateDocumentType,
  type UpdateDocumentTypeData,
} from "../../../utilities/api/updateDocumentType";
import { deleteDocumentType } from "../../../utilities/api/deleteDocumentType";
import { fetchFolders } from "../../../utilities/api/fetchFolders";
import { createDocumentTypeFromSystem } from "../../../utilities/api/createDocumentTypeFromSystem";
import {
  createDocumentTypeCustom,
  CreateCustomDocumentTypeParams,
} from "../../../utilities/api/createDocumentTypeCustom";
import { useConfirm } from "../../../context-providers/confirm-provider/ConfirmProvider";
import type { PortableSchema } from "../utils/portableSchema";

interface SchemaPageContextValue {
  documentTypes: DocumentTypeRecord[];
  selectedSchemaId: string | null;
  selectedSchema: DocumentTypeRecord | null;
  isLoading: boolean;
  error: string | null;
  selectSchema: (id: string | null) => void;
  refreshSchemas: () => Promise<void>;
  updateField: (
    collectionKey: string | undefined,
    oldFieldName: string,
    newField: FieldDefinition
  ) => Promise<void>;
  reorderFields: (
    collectionKey: string | undefined,
    fieldNames: string[]
  ) => Promise<void>;
  addField: (
    collectionKey: string | undefined,
    newField: FieldDefinition
  ) => Promise<void>;
  deleteField: (
    collectionKey: string | undefined,
    fieldName: string
  ) => Promise<void>;
  addLineItemCollection: (
    collectionKey: string,
    newCollection: Omit<LineItemCollectionSchema, "fields">
  ) => Promise<void>;
  deleteLineItemCollection: (collectionKey: string) => Promise<void>;
  deleteSchema: () => Promise<void>;
  addSchemaFromSystem: (systemTypeName: string) => Promise<void>;
  addCustomSchema: (params: CreateCustomDocumentTypeParams) => Promise<void>;
  updateSchemaDetails: (data: {
    displayName?: string | null;
    description?: string | null;
    extractionHint?: string | null;
    defaultFolderId?: string | null;
    folderMapping?: FolderMapping[] | null;
  }) => Promise<void>;
  // Local editable state
  localDisplayName: string;
  setLocalDisplayName: (value: string) => void;
  localDescription: string;
  setLocalDescription: (value: string) => void;
  localExtractionHint: string;
  setLocalExtractionHint: (value: string) => void;
  localDefaultFolderId: string | null;
  setLocalDefaultFolderId: (value: string | null) => void;
  localFolderMapping: FolderMapping[];
  setLocalFolderMapping: (value: FolderMapping[]) => void;
  // Action buttons state
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  handleSave: () => Promise<void>;
  saveNow: () => void;
  handleCancel: () => void;
  handleDeleteSchema: () => Promise<void>;
  uploadSchema: (portable: PortableSchema) => Promise<void>;
  // Show hidden fields state
  showHidden: boolean;
  setShowHidden: (value: boolean) => void;
}

const SchemaPageContext = createContext<SchemaPageContextValue | undefined>(
  undefined
);

export function SchemaPageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org } = useOrgStore();
  const t = useTranslations("schema");
  const confirm = useConfirm();
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRecord[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local editable state
  const [localDisplayName, setLocalDisplayName] = useState<string>("");
  const [localDescription, setLocalDescription] = useState<string>("");
  const [localExtractionHint, setLocalExtractionHint] = useState<string>("");
  const [localDefaultFolderId, setLocalDefaultFolderId] = useState<
    string | null
  >(null);
  const [localFolderMapping, setLocalFolderMapping] = useState<FolderMapping[]>(
    []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Always show hidden fields - set to false to restore toggle functionality
  const [showHidden, setShowHidden] = useState(true);

  const fetchSchemas = useCallback(async () => {
    if (!org?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const types = await fetchDocumentTypes({
        includeDatasets: false,
      });
      types.sort((a, b) => a.displayName?.localeCompare(b.displayName || "") || 0);
      setDocumentTypes(types);
    } catch (err) {
      console.error("Failed to fetch schemas:", err);
      setError("Failed to load schemas");
      toast.error(t("errorLoading"));
    } finally {
      setIsLoading(false);
    }
  }, [org?.id, t]);

  useEffect(() => {
    fetchSchemas();
    // Load folder tree so folder names resolve immediately
    fetchFolders().catch(console.error);
  }, [fetchSchemas]);

  const selectedSchema = useMemo(() => {
    if (!selectedSchemaId) return null;
    return documentTypes.find((t) => t.id === selectedSchemaId) || null;
  }, [selectedSchemaId, documentTypes]);

  // Sync local state when selectedSchema changes
  useEffect(() => {
    if (selectedSchema) {
      setLocalDisplayName(selectedSchema.displayName || "");
      setLocalDescription(selectedSchema.description || "");
      setLocalExtractionHint(selectedSchema.extractionHint || "");
      setLocalDefaultFolderId(selectedSchema.defaultFolderId || null);
      setLocalFolderMapping(selectedSchema.folderMapping || []);
    }
  }, [selectedSchema]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedSchema) return false;
    const originalDisplayName = selectedSchema.displayName || "";
    const originalDescription = selectedSchema.description || "";
    const originalExtractionHint = selectedSchema.extractionHint || "";
    const originalDefaultFolderId = selectedSchema.defaultFolderId || null;
    const originalFolderMapping = selectedSchema.folderMapping || [];

    return (
      localDisplayName !== originalDisplayName ||
      localDescription !== originalDescription ||
      localExtractionHint !== originalExtractionHint ||
      localDefaultFolderId !== originalDefaultFolderId ||
      JSON.stringify(localFolderMapping) !==
      JSON.stringify(originalFolderMapping)
    );
  }, [
    selectedSchema,
    localDisplayName,
    localDescription,
    localExtractionHint,
    localDefaultFolderId,
    localFolderMapping,
  ]);

  const selectSchema = useCallback((id: string | null) => {
    setSelectedSchemaId(id);
  }, []);

  const updateField = useCallback(
    async (
      collectionKey: string | undefined,
      oldFieldName: string,
      newField: FieldDefinition
    ) => {
      if (!selectedSchema) return;

      try {
        let updateData: any = {};

        if (!collectionKey) {
          // Update header schema
          const newHeaderSchema = selectedSchema.headerSchema.map((f) =>
            f.name === oldFieldName ? newField : f
          );
          updateData.headerSchema = newHeaderSchema;
        } else {
          // Update line item schema
          const collection = selectedSchema.lineItemSchemas?.[collectionKey];
          if (!collection) return;

          const newFields = collection.fields.map((f) =>
            f.name === oldFieldName ? newField : f
          );

          updateData.lineItemSchemas = {
            ...selectedSchema.lineItemSchemas,
            [collectionKey]: {
              ...collection,
              fields: newFields,
            },
          };
        }

        const updated = await updateDocumentType(selectedSchema.id, updateData);
        setDocumentTypes((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success(t("fieldUpdated"));
      } catch (err) {
        console.error("Failed to update field:", err);
        toast.error(t("updateFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const reorderFields = useCallback(
    async (collectionKey: string | undefined, fieldNames: string[]) => {
      if (!selectedSchema) return;

      try {
        let updateData: any = {};

        if (!collectionKey) {
          // Reorder header schema
          const fieldMap = new Map(
            selectedSchema.headerSchema.map((f) => [f.name, f])
          );
          const reorderedFields = fieldNames
            .map((name) => fieldMap.get(name))
            .filter((f): f is FieldDefinition => f !== undefined);
          updateData.headerSchema = reorderedFields;
        } else {
          // Reorder line item schema
          const collection = selectedSchema.lineItemSchemas?.[collectionKey];
          if (!collection) return;

          const fieldMap = new Map(collection.fields.map((f) => [f.name, f]));
          const reorderedFields = fieldNames
            .map((name) => fieldMap.get(name))
            .filter((f): f is FieldDefinition => f !== undefined);

          updateData.lineItemSchemas = {
            ...selectedSchema.lineItemSchemas,
            [collectionKey]: {
              ...collection,
              fields: reorderedFields,
            },
          };
        }

        const updated = await updateDocumentType(selectedSchema.id, updateData);
        setDocumentTypes((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success(t("fieldsReordered"));
      } catch (err) {
        console.error("Failed to reorder fields:", err);
        toast.error(t("reorderFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const addField = useCallback(
    async (collectionKey: string | undefined, newField: FieldDefinition) => {
      if (!selectedSchema) return;

      try {
        let updateData: any = {};

        if (!collectionKey) {
          // Add to header schema
          const existingNames = selectedSchema.headerSchema.map((f) => f.name);
          if (existingNames.includes(newField.name)) {
            toast.error(t("fieldNameExists"));
            return;
          }
          updateData.headerSchema = [...selectedSchema.headerSchema, newField];
        } else {
          // Add to line item schema
          const collection = selectedSchema.lineItemSchemas?.[collectionKey];
          if (!collection) return;

          const existingNames = collection.fields.map((f) => f.name);
          if (existingNames.includes(newField.name)) {
            toast.error(t("fieldNameExists"));
            return;
          }

          updateData.lineItemSchemas = {
            ...selectedSchema.lineItemSchemas,
            [collectionKey]: {
              ...collection,
              fields: [...collection.fields, newField],
            },
          };
        }

        const updated = await updateDocumentType(selectedSchema.id, updateData);
        setDocumentTypes((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success(t("fieldAdded"));
      } catch (err) {
        console.error("Failed to add field:", err);
        toast.error(t("addFieldFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const deleteField = useCallback(
    async (collectionKey: string | undefined, fieldName: string) => {
      if (!selectedSchema) return;

      try {
        let updateData: any = {};

        if (!collectionKey) {
          // Delete from header schema
          const newHeaderSchema = selectedSchema.headerSchema.filter(
            (f) => f.name !== fieldName
          );
          updateData.headerSchema = newHeaderSchema;
        } else {
          // Delete from line item schema
          const collection = selectedSchema.lineItemSchemas?.[collectionKey];
          if (!collection) return;

          const newFields = collection.fields.filter(
            (f) => f.name !== fieldName
          );

          updateData.lineItemSchemas = {
            ...selectedSchema.lineItemSchemas,
            [collectionKey]: {
              ...collection,
              fields: newFields,
            },
          };
        }

        const updated = await updateDocumentType(selectedSchema.id, updateData);
        setDocumentTypes((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success(t("fieldDeleted"));
      } catch (err) {
        console.error("Failed to delete field:", err);
        toast.error(t("deleteFieldFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const addLineItemCollection = useCallback(
    async (
      collectionKey: string,
      newCollection: Omit<LineItemCollectionSchema, "fields">
    ) => {
      if (!selectedSchema) return;

      if (selectedSchema.lineItemSchemas?.[collectionKey]) {
        toast.error(t("collectionKeyExists"));
        return;
      }

      try {
        const updateData = {
          lineItemSchemas: {
            ...(selectedSchema.lineItemSchemas || {}),
            [collectionKey]: {
              ...newCollection,
              fields: [],
            },
          },
        };

        const updated = await updateDocumentType(selectedSchema.id, updateData);
        setDocumentTypes((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success(t("collectionAdded"));
      } catch (err) {
        console.error("Failed to add collection:", err);
        toast.error(t("addCollectionFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const deleteLineItemCollection = useCallback(
    async (collectionKey: string) => {
      if (!selectedSchema) return;

      const collection = selectedSchema.lineItemSchemas?.[collectionKey];
      if (!collection) return;

      try {
        const newLineItemSchemas = { ...selectedSchema.lineItemSchemas };
        delete newLineItemSchemas[collectionKey];

        const updateData = {
          lineItemSchemas:
            Object.keys(newLineItemSchemas).length > 0
              ? newLineItemSchemas
              : null,
        };

        const updated = await updateDocumentType(selectedSchema.id, updateData);
        setDocumentTypes((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success(t("collectionDeleted"));
      } catch (err) {
        console.error("Failed to delete collection:", err);
        toast.error(t("deleteCollectionFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const deleteSchema = useCallback(async () => {
    if (!selectedSchema) return;

    try {
      await deleteDocumentType(selectedSchema.id);
      setDocumentTypes((prev) =>
        prev.filter((t) => t.id !== selectedSchema.id)
      );
      setSelectedSchemaId(null);
      toast.success(t("schemaDeleted"));
    } catch (err) {
      console.error("Failed to delete schema:", err);
      toast.error(t("deleteSchemaFailed"));
      throw err;
    }
  }, [selectedSchema, t]);

  const addSchemaFromSystem = useCallback(
    async (systemTypeName: string) => {
      try {
        const created = await createDocumentTypeFromSystem(systemTypeName);
        setDocumentTypes((prev) => [...prev, created]);
        setSelectedSchemaId(created.id);
        toast.success(t("schemaAdded"));
      } catch (err) {
        console.error("Failed to add schema:", err);
        toast.error(t("addSchemaFailed"));
        throw err;
      }
    },
    [t]
  );

  const addCustomSchema = useCallback(
    async (params: CreateCustomDocumentTypeParams) => {
      try {
        const created = await createDocumentTypeCustom(params);
        setDocumentTypes((prev) => [...prev, created]);
        setSelectedSchemaId(created.id);
        toast.success(t("schemaAdded"));
      } catch (err) {
        console.error("Failed to create custom schema:", err);
        toast.error(t("addSchemaFailed"));
        throw err;
      }
    },
    [t]
  );

  const updateSchemaDetails = useCallback(
    async (data: {
      displayName?: string | null;
      description?: string | null;
      extractionHint?: string | null;
      defaultFolderId?: string | null;
      folderMapping?: FolderMapping[] | null;
    }) => {
      if (!selectedSchema) return;

      try {
        const updated = await updateDocumentType(selectedSchema.id, data);
        setDocumentTypes((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success(t("schemaDetailsUpdated"));
      } catch (err) {
        console.error("Failed to update schema details:", err);
        toast.error(t("updateDetailsFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const handleSave = useCallback(async () => {
    if (!selectedSchema || !hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      await updateSchemaDetails({
        displayName: localDisplayName || null,
        description: localDescription || null,
        extractionHint: localExtractionHint || null,
        defaultFolderId: localDefaultFolderId,
        folderMapping: localFolderMapping,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedSchema,
    hasUnsavedChanges,
    localDisplayName,
    localDescription,
    localExtractionHint,
    localDefaultFolderId,
    localFolderMapping,
    updateSchemaDetails,
  ]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const saveNow = useCallback(() => {
    setTimeout(() => {
      handleSaveRef.current();
    }, 0);
  }, []);

  const handleCancel = useCallback(() => {
    if (!selectedSchema) return;
    setLocalDisplayName(selectedSchema.displayName || "");
    setLocalDescription(selectedSchema.description || "");
    setLocalExtractionHint(selectedSchema.extractionHint || "");
    setLocalDefaultFolderId(selectedSchema.defaultFolderId || null);
    setLocalFolderMapping(selectedSchema.folderMapping || []);
  }, [selectedSchema]);

  const handleDeleteSchema = useCallback(async () => {
    if (!selectedSchema) return;

    const schemaName = selectedSchema.displayName || selectedSchema.name;
    const confirmed = await confirm({
      title: t("deleteSchemaTitle"),
      message: t("deleteSchemaConfirmation", { name: schemaName }),
      confirmLabel: t("deleteSchema"),
      cancelLabel: t("cancel"),
    });

    if (confirmed) {
      setIsDeleting(true);
      try {
        await deleteSchema();
      } finally {
        setIsDeleting(false);
      }
    }
  }, [selectedSchema, confirm, t, deleteSchema]);

  const uploadSchema = useCallback(
    async (portable: PortableSchema) => {
      if (!selectedSchema) return;

      const updateData: UpdateDocumentTypeData = {
        displayName: portable.displayName ?? selectedSchema.displayName,
        description: portable.description ?? selectedSchema.description,
        extractionHint: portable.extractionHint ?? selectedSchema.extractionHint,
        headerSchema: portable.headerSchema,
        lineItemSchemas: portable.lineItemSchemas ?? null,
        icon: portable.icon ?? selectedSchema.icon,
        color: portable.color ?? selectedSchema.color,
      };
      if (portable.isDataset !== undefined) {
        updateData.isDataset = portable.isDataset;
      }

      try {
        const updated = await updateDocumentType(selectedSchema.id, updateData);
        setDocumentTypes((prev) =>
          prev.map((type) => (type.id === updated.id ? updated : type))
        );
        toast.success(t("schemaUploaded"));
      } catch (err) {
        console.error("Failed to upload schema:", err);
        toast.error(t("uploadSchemaFailed"));
        throw err;
      }
    },
    [selectedSchema, t]
  );

  const value = useMemo(
    () => ({
      documentTypes,
      selectedSchemaId,
      selectedSchema,
      isLoading,
      error,
      selectSchema,
      refreshSchemas: fetchSchemas,
      updateField,
      reorderFields,
      addField,
      deleteField,
      addLineItemCollection,
      deleteLineItemCollection,
      deleteSchema,
      addSchemaFromSystem,
      addCustomSchema,
      updateSchemaDetails,
      // Local editable state
      localDisplayName,
      setLocalDisplayName,
      localDescription,
      setLocalDescription,
      localExtractionHint,
      setLocalExtractionHint,
      localDefaultFolderId,
      setLocalDefaultFolderId,
      localFolderMapping,
      setLocalFolderMapping,
      // Action buttons state
      hasUnsavedChanges,
      isSaving,
      isDeleting,
      handleSave,
      saveNow,
      handleCancel,
      handleDeleteSchema,
      uploadSchema,
      // Show hidden fields state
      showHidden,
      setShowHidden,
    }),
    [
      documentTypes,
      selectedSchemaId,
      selectedSchema,
      isLoading,
      error,
      selectSchema,
      fetchSchemas,
      updateField,
      reorderFields,
      addField,
      deleteField,
      addLineItemCollection,
      deleteLineItemCollection,
      deleteSchema,
      addSchemaFromSystem,
      addCustomSchema,
      updateSchemaDetails,
      localDisplayName,
      setLocalDisplayName,
      localDescription,
      setLocalDescription,
      localExtractionHint,
      setLocalExtractionHint,
      localDefaultFolderId,
      setLocalDefaultFolderId,
      localFolderMapping,
      setLocalFolderMapping,
      hasUnsavedChanges,
      isSaving,
      isDeleting,
      handleSave,
      saveNow,
      handleCancel,
      handleDeleteSchema,
      uploadSchema,
      showHidden,
      setShowHidden,
    ]
  );

  return (
    <SchemaPageContext.Provider value={value}>
      {children}
    </SchemaPageContext.Provider>
  );
}

export function useSchemaPage() {
  const context = useContext(SchemaPageContext);
  if (context === undefined) {
    throw new Error("useSchemaPage must be used within a SchemaPageProvider");
  }
  return context;
}
