"use client";

import { Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { useTranslations } from "next-intl";
import { FieldDefinition } from "@zdocs/types";
import { DraggableFieldGrid } from "../DraggableFieldGrid";
import { FieldEditDialog } from "../FieldEditDialog";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

export function SchemaHeaderFields() {
  const { selectedSchema, showHidden } = useSchemaPage();
  const t = useTranslations("schema");
  const [editingField, setEditingField] = useState<{
    field: FieldDefinition;
    collectionKey?: string;
  } | null>(null);
  const { logEvent } = useLogUserJourneyEvent();

  const headerFields = useMemo(() => {
    if (!selectedSchema?.headerSchema) return [];
    return selectedSchema.headerSchema.filter((f) => showHidden || !f.hidden);
  }, [selectedSchema, showHidden]);

  if (!selectedSchema) {
    return null;
  }

  const handleFieldClick = (field: FieldDefinition, collectionKey?: string) => {
    setEditingField({ field, collectionKey });
    logEvent({
      eventType: "schema_field_clicked",
      eventData: {
        fieldName: field.name,
        fieldDisplayName: field.displayName,
        collectionKey,
      },
    });
  };

  return (
    <div data-testid="schema-header-fields">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">
          {t("fieldsToExtract")}
        </h2>
      </div>
      <DraggableFieldGrid
        fields={headerFields}
        schemaName={selectedSchema.name}
        onFieldClick={handleFieldClick}
      />
      <FieldEditDialog
        editingField={editingField}
        onClose={() => setEditingField(null)}
      />
    </div>
  );
}
