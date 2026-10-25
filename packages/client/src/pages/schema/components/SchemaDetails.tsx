"use client";

import { useRef, useState } from "react";
import { Database, Upload } from "lucide-react";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useTranslations } from "next-intl";
import { SchemaDetailSidebar, type SchemaDetailSection } from "./SchemaDetailSidebar";
import { SchemaHeaderInfo } from "./sections/SchemaHeaderInfo";
import { SchemaGeneralSettings } from "./sections/SchemaGeneralSettings";
import { SchemaHeaderFields } from "./sections/SchemaHeaderFields";
import { SchemaLineItemCollections } from "./sections/SchemaLineItemCollections";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import { toast } from "sonner";
import { Button } from "@zdocs/client-component";
import { createDocumentTypeCustom } from "../../../utilities/api/createDocumentTypeCustom";
import { useConfirm } from "../../../context-providers/confirm-provider/ConfirmProvider";
import type { FieldDefinition, LineItemCollectionSchema } from "@zdocs/types";

export function SchemaDetails() {
  const { selectedSchema, documentTypes, refreshSchemas, selectSchema } = useSchemaPage();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("schema");
  const [activeSection, setActiveSection] =
    useState<SchemaDetailSection>("settings");
  const { logEvent } = useLogUserJourneyEvent();

  const handleSectionChange = (section: SchemaDetailSection) => {
    setActiveSection(section);
    logEvent({
      eventType: "schema_section_changed",
      eventData: { section },
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!data.name || typeof data.name !== "string") {
        toast.error(t("invalidSchemaFile"));
        return;
      }
      const existing = documentTypes.find((dt) => dt.name === data.name);
      if (existing) {
        const displayName = existing.displayName || existing.name;
        const confirmed = await confirm({
          title: t("uploadOverrideTitle"),
          message: t("uploadOverrideConfirmation", { name: displayName }),
          confirmLabel: t("uploadSchema"),
          cancelLabel: t("cancel"),
        });
        if (!confirmed) return;
      }

      const headerSchema = Array.isArray(data.headerSchema)
        ? (data.headerSchema as FieldDefinition[])
        : [];
      const lineItemSchemas = data.lineItemSchemas != null &&
        typeof data.lineItemSchemas === "object" &&
        !Array.isArray(data.lineItemSchemas)
        ? (data.lineItemSchemas as Record<string, LineItemCollectionSchema>)
        : null;

      const created = await createDocumentTypeCustom({
        name: data.name,
        displayName: (data.displayName as string) || data.name,
        description: (data.description as string) || undefined,
        extractionHint: (data.extractionHint as string) || undefined,
        headerSchema,
        lineItemSchemas,
        icon: (data.icon as string) || undefined,
        color: (data.color as string) || undefined,
      });
      await refreshSchemas();
      selectSchema(created.id);
      toast.success(t("schemaUploaded"));
    } catch (err) {
      console.error("Failed to upload schema:", err);
      toast.error(t("uploadSchemaFailed"));
    }
  };

  if (!selectedSchema) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8"
        data-testid="schema-details-empty"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
        <Database className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">{t("noSchemaSelected")}</p>
        <p className="text-sm mb-4">{t("selectToViewDetails")}</p>
        <p className="text-sm mb-4">{t("uploadSchemaHint")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadClick}
          className="flex items-center gap-2"
          data-testid="upload-schema-button"
        >
          <Upload className="w-4 h-4" />
          {t("uploadSchema")}
        </Button>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case "settings":
        return <SchemaGeneralSettings />;
      case "main-fields":
        return <SchemaHeaderFields />;
      case "line-items":
        return <SchemaLineItemCollections />;
      default:
        return <SchemaGeneralSettings />;
    }
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden relative"
      data-testid="schema-details"
    >
      <SchemaHeaderInfo />

      <div className="flex-1 flex overflow-hidden">
        <SchemaDetailSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {renderActiveSection()}
        </div>
      </div>
    </div>
  );
}
