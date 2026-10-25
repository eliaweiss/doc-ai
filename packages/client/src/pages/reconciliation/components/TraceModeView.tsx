"use client";

import { useState, useEffect, useMemo } from "react";
import { TraceModeConfig } from "./TraceModeConfig";
import { TraceResultsTree } from "./TraceResultsTree";
import type {
  TraceRequest,
  TraceResponse,
  SearchableEntityOption,
} from "@zdocs/types";
import { useTranslations } from "next-intl";
import useOrgStore from "../../../context-providers/orgStore";
import { toast } from "sonner";

interface TraceModeViewProps {
  "data-testid"?: string;
}

export function TraceModeView({
  "data-testid": dataTestId,
}: TraceModeViewProps) {
  const t = useTranslations("reconciliation.trace");
  const { org } = useOrgStore();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TraceResponse | null>(null);
  const [entities, setEntities] = useState<SearchableEntityOption[]>([]);
  const [endSchemaTypes, setEndSchemaTypes] = useState<string[]>([]);

  // Fetch searchable entities for display name lookup
  useEffect(() => {
    if (org?.id) {
      fetch(`/api/org/${org.id}/search/searchable-entities`)
        .then((res) => res.json())
        .then((data) => setEntities(data.entities || []))
        .catch(console.error);
    }
  }, [org?.id]);

  // Create a map from schemaType to displayName
  const schemaTypeToDisplayName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entity of entities) {
      map[entity.schemaType] = entity.displayName;
    }
    return map;
  }, [entities]);

  const handleTrace = async (
    params: TraceRequest,
    selectedEndSchemaTypes: string[]
  ) => {
    // Store the selected end schema types for client-side matching
    setEndSchemaTypes(selectedEndSchemaTypes);
    if (!org?.id) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/org/${org.id}/reconciliation/trace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) throw new Error("Failed to trace money flow");

      const data = await res.json();
      setResults(data);
      // toast.success(t("success"));
    } catch (error) {
      console.error("Trace error:", error);
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-6 h-full  overflow-auto"
      data-testid={dataTestId}
    >
      <TraceModeConfig onTrace={handleTrace} loading={loading} />

      <div
        className="flex-1 border rounded-lg bg-card min-h-0"
        data-testid="trace-results-container"
      >
        {loading ? (
          <div
            className="flex items-center justify-center h-full"
            data-testid="trace-loading"
          >
            <div
              className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"
              data-testid="trace-loading-spinner"
            />
          </div>
        ) : results ? (
          <TraceResultsTree
            results={results}
            schemaTypeToDisplayName={schemaTypeToDisplayName}
            endSchemaTypes={endSchemaTypes}
            entitySchemas={entities}
          />
        ) : (
          <div
            className="flex items-center justify-center h-full text-muted-foreground"
            data-testid="trace-empty-state"
          >
            {t("noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
