"use client";

import { useState } from "react";
import { FileText, LayoutList, Plus } from "lucide-react";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { AddSchemaDialog } from "./AddSchemaDialog";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface SchemaSidebarProps {
  onSchemaSelect?: () => void;
}

export function SchemaSidebar({ onSchemaSelect }: SchemaSidebarProps) {
  const { documentTypes, selectedSchemaId, selectSchema } = useSchemaPage();
  const t = useTranslations("schema");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();

  const handleSchemaSelect = (schemaId: string) => {
    const schema = documentTypes.find((t) => t.id === schemaId);
    selectSchema(schemaId);
    onSchemaSelect?.();
    logEvent({
      eventType: "schema_selected",
      eventData: {
        schemaId,
        schemaName: schema?.name,
        schemaDisplayName: schema?.displayName,
      },
    });
  };

  const handleAddDialogOpen = () => {
    setShowAddDialog(true);
    logEvent({
      eventType: "schema_add_dialog_opened",
    });
  };

  return (
    <div className="py-2" data-testid="schema-sidebar-list">
      {/* Add Type Button */}
      <div className="px-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddDialogOpen}
          className="w-full flex items-center gap-2"
          data-testid="add-schema-button"
        >
          <Plus className="w-4 h-4" />
          {t("addType")}
        </Button>
      </div>

      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("documentTypes")}
      </div>

      {documentTypes.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          {t("noSchemasFound")}
        </div>
      ) : (
        <div className="space-y-1 px-2">
          {documentTypes.map((type) => {
            const isSelected = selectedSchemaId === type.id;
            return (
              <button
                key={type.id}
                onClick={() => handleSchemaSelect(type.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                data-testid={`schema-item-${type.name}`}
              >
                {/* Dataset pipeline disabled - all types use FileText icon */}
                <FileText className={`w-4 h-4 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span className="truncate text-left font-medium">
                  {type.displayName || type.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <AddSchemaDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}

