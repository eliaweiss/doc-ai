"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  FieldDefinition,
  EntityResponse,
  GraphAggregationMode,
  GraphSettings,
} from "@zdocs/types";
import { formatDate } from "@zdocs/util";

interface SchemaGraphProps {
  schema: FieldDefinition[];
  results: EntityResponse[];
  currency?: string | null;
  graphSettings?: GraphSettings;
  onGraphSettingsChange?: (settings: GraphSettings) => void;
}

interface AxisOption {
  field: FieldDefinition;
  label: string;
}

/**
 * Graph component with axis options derived from schema
 */
export function SchemaGraph({
  schema,
  results,
  graphSettings,
  onGraphSettingsChange,
}: SchemaGraphProps) {
  const t = useTranslations("search");

  // Get axis options from schema
  const { xAxisOptions, yAxisOptions } = useMemo(() => {
    const xOptions: AxisOption[] = [];
    const yOptions: AxisOption[] = [];
    // Track seen field names to prevent duplicates (fail-safe)
    const seenXNames = new Set<string>();
    const seenYNames = new Set<string>();

    // Helper to add option with deduplication
    const addXOption = (option: AxisOption) => {
      if (!seenXNames.has(option.field.name)) {
        xOptions.push(option);
        seenXNames.add(option.field.name);
      }
    };
    const addYOption = (option: AxisOption) => {
      if (!seenYNames.has(option.field.name)) {
        yOptions.push(option);
        seenYNames.add(option.field.name);
      }
    };

    for (const field of schema) {
      const option: AxisOption = {
        field,
        label: field.displayName,
      };

      // Determine which axes this field can be used on
      const axis = field.axis;
      if (axis === "both") {
        addXOption(option);
        addYOption(option);
      } else if (axis === "x") {
        addXOption(option);
      } else if (axis === "y") {
        addYOption(option);
      } else if (axis === "none") {
        // Skip
      } else {
        // Default based on field type
        switch (field.type) {
          case "date":
          case "text":
          case "enum":
            addXOption(option);
            break;
          case "number":
          case "currency":
            addYOption(option);
            break;
          default:
            addXOption(option);
        }
      }
    }

    // Add document date from metadata (only if schema doesn't have a "date" field)
    addXOption({
      field: {
        name: "date",
        type: "date",
        displayName: t("documentDate"),
      },
      label: t("documentDate"),
    });

    // Note: We don't add "amount" here - schemas already define their own amount/price fields

    return { xAxisOptions: xOptions, yAxisOptions: yOptions };
  }, [schema, t]);

  // Find preferred defaults: date for X, unitPrice/amount for Y
  const defaultXAxis = useMemo(() => {
    const dateOption = xAxisOptions.find((opt) => opt.field.name === "date");
    return dateOption?.field.name || xAxisOptions[0]?.field.name || "";
  }, [xAxisOptions]);

  const defaultYAxis = useMemo(() => {
    // Prefer unitPrice, then amount, then first available
    const priceOption = yAxisOptions.find(
      (opt) => opt.field.name === "unitPrice" || opt.field.name === "price"
    );
    const amountOption = yAxisOptions.find(
      (opt) => opt.field.name === "amount"
    );
    return (
      priceOption?.field.name ||
      amountOption?.field.name ||
      yAxisOptions[0]?.field.name ||
      ""
    );
  }, [yAxisOptions]);

  // State for graph settings
  const [xAxis, setXAxis] = useState<string>(graphSettings?.xColumn || "");
  const [yAxis, setYAxis] = useState<string>(graphSettings?.yColumn || "");
  const chartType = "line";
  const [aggregationMode, setAggregationMode] = useState<GraphAggregationMode>(
    graphSettings?.aggregationMode || "value"
  );

  // Set defaults when schema changes - validate saved settings exist in current schema
  useEffect(() => {
    // Check if current xAxis is valid for this schema
    const xAxisValid =
      xAxis && xAxisOptions.some((opt) => opt.field.name === xAxis);
    if (!xAxisValid && defaultXAxis) {
      setXAxis(defaultXAxis);
    }

    // Check if current yAxis is valid for this schema
    const yAxisValid =
      yAxis && yAxisOptions.some((opt) => opt.field.name === yAxis);
    if (!yAxisValid && defaultYAxis) {
      setYAxis(defaultYAxis);
    }
  }, [defaultXAxis, defaultYAxis, xAxis, yAxis, xAxisOptions, yAxisOptions]);

  // Sync state with props when props change (e.g. when loading a saved query)
  // Only apply saved settings if they're valid for the current schema
  useEffect(() => {
    if (graphSettings) {
      if (
        graphSettings.xColumn &&
        xAxisOptions.some((opt) => opt.field.name === graphSettings.xColumn)
      ) {
        setXAxis(graphSettings.xColumn);
      }
      if (
        graphSettings.yColumn &&
        yAxisOptions.some((opt) => opt.field.name === graphSettings.yColumn)
      ) {
        setYAxis(graphSettings.yColumn);
      }
      if (graphSettings.aggregationMode) {
        setAggregationMode(graphSettings.aggregationMode);
      }
    }
  }, [graphSettings, xAxisOptions, yAxisOptions]);

  // Update parent whenever settings change
  useEffect(() => {
    if (onGraphSettingsChange && (xAxis || yAxis)) {
      onGraphSettingsChange({
        xColumn: xAxis,
        yColumn: yAxis,
        chartType,
        aggregationMode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xAxis, yAxis, chartType, aggregationMode]);

  // Transform results to chart data
  const chartData = useMemo(() => {
    if (!xAxis || !yAxis || results.length === 0) return [];

    // Extract values from results
    const rawData = results
      .map((result) => {
        const preview = result.preview || {};
        const data = result.data || {};
        for (const key in preview) {
          if (!data[key]) {
            data[key] = preview[key as keyof typeof preview];
          }
        }

        // Get X value - check data first (schema fields), then metadata (document fields)
        let xValue =
          xAxis === "date"
            ? data.date
            : xAxis === "fileName"
            ? result.file?.fileName
            : data[xAxis] ?? preview[xAxis as keyof typeof preview];

        // Get Y value - check data first (schema fields), then metadata (document fields)
        let yValue =
          yAxis === "amount"
            ? data.amount ?? preview.amount
            : data[yAxis] ?? preview[yAxis as keyof typeof preview];

        // Parse date for X axis
        if (xAxis === "date" && typeof xValue === "string") {
          const date = new Date(xValue);
          xValue = formatDate(date);
        }

        const numericY =
          typeof yValue === "number"
            ? yValue
            : typeof yValue === "string"
            ? parseFloat(yValue)
            : 0;

        return {
          x: xValue ?? "Unknown",
          y: isNaN(numericY as number) ? 0 : numericY,
        };
      })
      .filter((d) => d.x !== null && d.x !== undefined);

    // sort by date ascending
    rawData.sort((a, b) => {
      const aDate = new Date(a.x as string);
      const bDate = new Date(b.x as string);
      return aDate.getTime() - bDate.getTime();
    });

    // Aggregate if needed
    if (aggregationMode === "value") {
      return rawData.map((d) => ({ name: String(d.x), value: d.y }));
    }

    // Group by X axis
    const grouped = new Map<string, number[]>();
    for (const d of rawData) {
      const key = String(d.x);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(d.y);
    }

    // Apply aggregation
    return Array.from(grouped.entries()).map(([name, values]) => {
      let value: number;
      if (aggregationMode === "sum") {
        value = values.reduce((a, b) => a + b, 0);
      } else {
        // count
        value = values.length;
      }
      return { name, value };
    });
  }, [results, xAxis, yAxis, aggregationMode]);

  if (results.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 text-muted-foreground"
        data-testid="schema-graph-empty"
      >
        {t("noDataForGraph")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="schema-graph">
      {/* Graph controls */}
      <div
        className="flex flex-wrap gap-4 p-4 border-b border-border"
        data-testid="schema-graph-controls"
      >
        {/* X Axis selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">{t("xAxis")}:</label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value)}
            className="text-sm border rounded px-2 py-1 text-foreground"
            data-testid="schema-graph-x-axis"
          >
            {xAxisOptions.map((opt) => (
              <option key={opt.field.name} value={opt.field.name}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Y Axis selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">{t("yAxis")}:</label>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value)}
            className="text-sm border rounded px-2 py-1 text-foreground"
            data-testid="schema-graph-y-axis"
          >
            {yAxisOptions.map((opt) => (
              <option key={opt.field.name} value={opt.field.name}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Aggregation mode selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">
            {t("aggregation")}:
          </label>
          <select
            value={aggregationMode}
            onChange={(e) =>
              setAggregationMode(e.target.value as GraphAggregationMode)
            }
            className="text-sm border rounded px-2 py-1 text-foreground"
            data-testid="schema-graph-aggregation"
          >
            <option value="value">{t("rawValues")}</option>
            <option value="sum">{t("sum")}</option>
            <option value="count">{t("count")}</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 p-4" data-testid="schema-graph-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "4px",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
