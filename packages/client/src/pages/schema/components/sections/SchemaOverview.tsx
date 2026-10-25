"use client";

import { Database, Tag, Layers } from "lucide-react";
import { useMemo } from "react";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { useTranslations } from "next-intl";
import { Badge } from "@zdocs/client-component";

export function SchemaOverview() {
  const { selectedSchema, showHidden } = useSchemaPage();
  const t = useTranslations("schema");

  const headerFieldsCount = useMemo(() => {
    if (!selectedSchema?.headerSchema) return 0;
    return selectedSchema.headerSchema.filter((f) => showHidden || !f.hidden)
      .length;
  }, [selectedSchema, showHidden]);

  const lineItemCollectionsCount = useMemo(() => {
    if (!selectedSchema?.lineItemSchemas) return 0;
    return Object.keys(selectedSchema.lineItemSchemas).length;
  }, [selectedSchema]);

  if (!selectedSchema) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="schema-overview">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t("schemaInformation")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground w-32">
              {t("schemaName")}:
            </span>
            <Badge variant="outline" className="text-xs uppercase">
              {selectedSchema.name}
            </Badge>
          </div>
          {selectedSchema.isSystem && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-32">
                {t("type")}:
              </span>
              <Badge variant="secondary" className="text-xs">
                {t("systemType")}
              </Badge>
            </div>
          )}
          {/* Dataset pipeline disabled - dataset type display removed */}
          {false && selectedSchema.isDataset && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-32">
                {t("type")}:
              </span>
              <Badge
                variant="outline"
                className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20"
              >
                {t("dataset")}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t("schemaStructure")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              {t("headerFields")}:
            </span>
            <span className="text-sm text-foreground font-medium">
              {headerFieldsCount}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              {t("lineItemCollections")}:
            </span>
            <span className="text-sm text-foreground font-medium">
              {lineItemCollectionsCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
