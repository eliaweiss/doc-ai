"use client";

import { Database } from "lucide-react";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { Input } from "@zdocs/client-component";
import { SchemaActionButtons } from "../SchemaActionButtons";

export function SchemaHeaderInfo() {
  const {
    selectedSchema,
    localDisplayName,
    setLocalDisplayName,
  } = useSchemaPage();

  if (!selectedSchema) {
    return null;
  }

  return (
    <div className="px-4 py-2 border-b border-border bg-card" data-testid="schema-header-info">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{
              backgroundColor: selectedSchema.color || "var(--primary)",
              color: "white",
            }}
          >
            <Database className="w-4 h-4" />
          </div>
          <Input
            value={localDisplayName}
            onChange={(e) => setLocalDisplayName(e.target.value)}
            placeholder={selectedSchema.name}
            className="text-lg font-semibold h-auto py-0.5 px-2 border-transparent hover:border-input focus:border-input bg-transparent"
            data-testid="schema-display-name-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <SchemaActionButtons />
        </div>
      </div>
    </div>
  );
}
