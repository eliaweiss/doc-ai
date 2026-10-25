"use client";

import { Layers, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { useTranslations } from "next-intl";
import { Badge } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { FieldDefinition } from "@zdocs/types";
import { DraggableFieldGrid } from "../DraggableFieldGrid";
import { FieldEditDialog } from "../FieldEditDialog";
import { AddLineItemCollectionDialog } from "../AddLineItemCollectionDialog";
import { useConfirm } from "../../../../context-providers/confirm-provider/ConfirmProvider";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

export function SchemaLineItemCollections() {
  const {
    selectedSchema,
    showHidden,
    deleteLineItemCollection,
  } = useSchemaPage();
  const t = useTranslations("schema");
  const confirm = useConfirm();
  const [editingField, setEditingField] = useState<{
    field: FieldDefinition;
    collectionKey?: string;
  } | null>(null);
  const [isAddCollectionDialogOpen, setIsAddCollectionDialogOpen] =
    useState(false);
  const [deletingCollectionKey, setDeletingCollectionKey] = useState<
    string | null
  >(null);
  const { logEvent } = useLogUserJourneyEvent();

  const lineItemCollections = useMemo(() => {
    if (!selectedSchema?.lineItemSchemas) return [];
    return Object.entries(selectedSchema.lineItemSchemas).map(
      ([key, collection]) => ({
        key,
        ...collection,
        fields: collection.fields.filter((f) => showHidden || !f.hidden),
      })
    );
  }, [selectedSchema, showHidden]);

  const handleDeleteCollection = async (
    collectionKey: string,
    displayName: string
  ) => {
    const confirmed = await confirm({
      title: t("deleteCollectionTitle"),
      message: t("deleteCollectionConfirmation", { name: displayName }),
      confirmLabel: t("deleteCollection"),
      cancelLabel: t("cancel"),
    });

    if (confirmed) {
      setDeletingCollectionKey(collectionKey);
      try {
        await deleteLineItemCollection(collectionKey);
        logEvent({
          eventType: "schema_collection_deleted",
          eventData: {
            collectionKey,
            collectionDisplayName: displayName,
          },
        });
      } finally {
        setDeletingCollectionKey(null);
      }
    }
  };

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

  if (!selectedSchema) {
    return null;
  }

  return (
    <div data-testid="schema-line-item-collections">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">
          {t("tablesToExtract")}
        </h2>
      </div>

      {lineItemCollections.length > 0 && (
        <div className="space-y-10 mb-8">
          {lineItemCollections.map((collection) => (
            <div
              key={`${selectedSchema.name}_${collection.name}_${collection.key}`}
            >
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2"
                data-testid={`collection-${collection.key}`}
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {collection.displayName}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {collection.description && (
                    <span className="text-sm text-muted-foreground italic">
                      {collection.description}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      handleDeleteCollection(
                        collection.key,
                        collection.displayName
                      )
                    }
                    disabled={deletingCollectionKey === collection.key}
                    data-testid={`delete-collection-${collection.key}`}
                  >
                    {deletingCollectionKey === collection.key ? (
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <DraggableFieldGrid
                fields={collection.fields}
                schemaName={selectedSchema.name}
                collectionKey={collection.key}
                onFieldClick={handleFieldClick}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Button
          variant="outline"
          className="flex items-center gap-2 w-full max-w-xs border-dashed"
          onClick={() => {
            setIsAddCollectionDialogOpen(true);
            logEvent({
              eventType: "schema_collection_add_dialog_opened",
            });
          }}
          data-testid="add-collection-btn"
        >
          <Plus className="w-4 h-4" />
          {t("addLineItemCollectionButton")}
        </Button>
      </div>

      <FieldEditDialog
        editingField={editingField}
        onClose={() => setEditingField(null)}
      />

      <AddLineItemCollectionDialog
        open={isAddCollectionDialogOpen}
        onClose={() => setIsAddCollectionDialogOpen(false)}
      />
    </div>
  );
}
