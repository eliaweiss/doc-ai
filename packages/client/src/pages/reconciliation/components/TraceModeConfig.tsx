"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { CompactDateRangePicker } from "../../search/components/CompactDateRangePicker";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import { EntitySelector } from "../../search/components/EntitySelector";
import type { TraceRequest, SearchableEntityOption } from "@zdocs/types";
import { Search, Loader2 } from "lucide-react";
import useOrgStore from "../../../context-providers/orgStore";
import { useLedgerTrace } from "../context/LedgerTraceContext";

interface TraceModeConfigProps {
  onTrace: (params: TraceRequest, endSchemaTypes: string[]) => void;
  loading: boolean;
}

export function TraceModeConfig({ onTrace, loading }: TraceModeConfigProps) {
  const t = useTranslations("reconciliation.trace.config");
  const { org } = useOrgStore();

  const {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    dateRangeShortcut,
    setDateRangeShortcut,
    maxDepth,
    setMaxDepth,
    limit,
    setLimit,
    startSchemaTypes,
    setStartSchemaTypes,
    endSchemaTypes,
    setEndDocTypes,
  } = useLedgerTrace();

  const [availableEntities, setAvailableEntities] = useState<
    SearchableEntityOption[]
  >([]);

  useEffect(() => {
    if (org?.id) {
      fetchAvailableEntities();
    }
  }, [org?.id]);

  const fetchAvailableEntities = async () => {
    try {
      const res = await fetch(`/api/org/${org!.id}/search/searchable-entities`);
      if (!res.ok) return;
      const data = await res.json();
      setAvailableEntities(data.entities || []);
    } catch (error) {
      console.error("Failed to fetch entities:", error);
    }
  };

  const handleSubmit = () => {
    onTrace(
      {
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        startSchemaTypes:
          startSchemaTypes.length > 0 ? startSchemaTypes : undefined,
        maxDepth,
        limit,
      },
      endSchemaTypes // Pass the full schemaTypes for client-side matching
    );
  };

  return (
    <div
      className="flex flex-col gap-4 p-4 border rounded-lg bg-card shadow-sm"
      data-testid="trace-config-panel"
    >
      {/* Start Doc Types - EntitySelector for document type selection */}
      <div className="flex flex-col gap-2" data-testid="trace-config-doc-types">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("startSchemaTypes")}
        </Label>
        <EntitySelector
          entities={availableEntities}
          selectedKeys={startSchemaTypes}
          onSelectionChange={(keys) => setStartSchemaTypes(keys)}
          disabled={loading}
          hideAllOption
        />
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end"
        data-testid="trace-config-row-main"
      >
        {/* Date Filter */}
        <div
          className="flex flex-col gap-2"
          data-testid="trace-config-date-range"
        >
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("dateRange")}
          </Label>
          <CompactDateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateRangeChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }}
            selectedQuickRange={dateRangeShortcut}
            onQuickRangeChange={setDateRangeShortcut}
            disabled={loading}
          />
        </div>

        {/* Max Depth */}
        <div
          className="flex flex-col gap-2"
          data-testid="trace-config-max-depth"
        >
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("maxDepth")}
          </Label>
          <Input
            type="number"
            value={maxDepth}
            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
            min={1}
            max={20}
            disabled={loading}
            className="h-9"
            data-testid="trace-config-max-depth-input"
          />
        </div>

        {/* Limit */}
        <div className="flex flex-col gap-2" data-testid="trace-config-limit">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("limit")}
          </Label>
          <Input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            min={10}
            max={200}
            disabled={loading}
            className="h-9"
            data-testid="trace-config-limit-input"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="h-9"
          data-testid="trace-config-submit"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {t("submit")}
        </Button>
      </div>

      {/* End Doc Types - EntitySelector for target entity selection */}
      <div className="flex flex-col gap-2" data-testid="trace-config-end-types">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("endEntityIds")}
        </Label>
        <EntitySelector
          entities={availableEntities}
          selectedKeys={endSchemaTypes}
          onSelectionChange={(keys) => setEndDocTypes(keys)}
          disabled={loading}
          hideAllOption
        />
      </div>
    </div>
  );
}
