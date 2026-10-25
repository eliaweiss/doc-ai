"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { FieldDefinition } from "@zdocs/types";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import type { DryRunDocResult } from "../../../../utilities/api/dryRunFormula";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

export type FieldEditSection =
  | "coreProperties"
  | "formula"
  | "code"
  | "flags"
  | "displayAndBehavior";

interface FieldEditDialogContextValue {
  formData: FieldDefinition | null;
  setFormData: React.Dispatch<React.SetStateAction<FieldDefinition | null>>;
  editingField: {
    field: FieldDefinition;
    collectionKey?: string;
  } | null;
  isSaving: boolean;
  isDeleting: boolean;
  selectedSection: FieldEditSection;
  setSelectedSection: (section: FieldEditSection) => void;
  handleSave: () => Promise<void>;
  saveData: () => Promise<void>;
  handleDelete: () => Promise<void>;
  saveField: (updatedField: FieldDefinition) => Promise<void>;
  onClose: () => void;
  dryRunResults: DryRunDocResult[] | null;
  setDryRunResults: React.Dispatch<React.SetStateAction<DryRunDocResult[] | null>>;
  isDryRunning: boolean;
  setIsDryRunning: React.Dispatch<React.SetStateAction<boolean>>;
  showDialogFooter: boolean;
  setShowDialogFooter: React.Dispatch<React.SetStateAction<boolean>>;
}

const FieldEditDialogContext = createContext<
  FieldEditDialogContextValue | undefined
>(undefined);

interface FieldEditDialogProviderProps {
  children: ReactNode;
  editingField: {
    field: FieldDefinition;
    collectionKey?: string;
  } | null;
  onClose: () => void;
}

export function FieldEditDialogProvider({
  children,
  editingField,
  onClose,
}: FieldEditDialogProviderProps) {
  const { updateField, deleteField } = useSchemaPage();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<FieldDefinition | null>(null);
  const [selectedSection, setSelectedSection] = useState<FieldEditSection>("coreProperties");
  const [dryRunResults, setDryRunResults] = useState<DryRunDocResult[] | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [showDialogFooter, setShowDialogFooter] = useState(true);
  const { logEvent } = useLogUserJourneyEvent();

  useEffect(() => {
    if (editingField) {
      setFormData({ ...editingField.field });
      setSelectedSection(editingField.field.type === "code" ? "code" : "coreProperties");
    } else {
      setFormData(null);
    }
    setDryRunResults(null);
    setIsDryRunning(false);
  }, [editingField]);

  // Validate selected section when formData type changes
  useEffect(() => {
    if (!formData) return;

    // Migrate old section types to new combined section
    const sectionStr = selectedSection as string;
    if (
      sectionStr === "searchAndDisplay" ||
      sectionStr === "denormalization" ||
      sectionStr === "graphAndVisualization"
    ) {
      setSelectedSection("displayAndBehavior");
    }

    // If current section is invalid for the field type, switch to coreProperties
    if (selectedSection === "formula" && formData.type !== "sum" && formData.type !== "code") {
      setSelectedSection("coreProperties");
    } else if (selectedSection === "code" && formData.type !== "code") {
      setSelectedSection("coreProperties");
    }
  }, [formData?.type, selectedSection]);

  const saveField = async (updatedField: FieldDefinition) => {
    if (!editingField) return;
    try {
      await updateField(
        editingField.collectionKey,
        editingField.field.name,
        updatedField
      );
    } catch (err) {
      // Error handled by updateField (shows toast)
    }
  };

  const handleSave = async () => {
    if (!formData || !editingField) return;

    setIsSaving(true);
    try {
      await saveField(formData);
      logEvent({
        eventType: "schema_field_saved",
        eventData: {
          fieldName: formData.name,
          fieldDisplayName: formData.displayName,
          collectionKey: editingField.collectionKey,
        },
      });
      onClose();
    } catch (err) {
      // Error handled by provider
    } finally {
      setIsSaving(false);
    }
  };


  const saveData = async () => {
    if (!formData || !editingField) return;

    setIsSaving(true);
    try {
      await saveField(formData);
    } catch (err) {
      // Error handled by provider
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingField) return;

    setIsDeleting(true);
    try {
      await deleteField(editingField.collectionKey, editingField.field.name);
      logEvent({
        eventType: "schema_field_deleted",
        eventData: {
          fieldName: editingField.field.name,
          fieldDisplayName: editingField.field.displayName,
          collectionKey: editingField.collectionKey,
        },
      });
      onClose();
    } catch (err) {
      // Error handled by provider
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <FieldEditDialogContext.Provider
      value={{
        formData,
        setFormData,
        editingField,
        isSaving,
        isDeleting,
        selectedSection,
        setSelectedSection,
        handleSave,
        saveData,
        handleDelete,
        saveField,
        onClose,
        dryRunResults,
        setDryRunResults,
        isDryRunning,
        setIsDryRunning,
        showDialogFooter,
        setShowDialogFooter,
      }}
    >
      {children}
    </FieldEditDialogContext.Provider>
  );
}

export function useFieldEditDialog() {
  const context = useContext(FieldEditDialogContext);
  if (context === undefined) {
    throw new Error(
      "useFieldEditDialog must be used within a FieldEditDialogProvider"
    );
  }
  return context;
}

