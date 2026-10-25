"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { FieldDefinition } from "@zdocs/types";
import { formatDate, formatCurrency, getCurrencySymbol } from "@zdocs/util";
import { EditableField } from "./EditableField";
import FormatCurrency from "./FormatCurrency";

interface SchemaFieldRendererProps {
  field: FieldDefinition;
  value: unknown;
  onChange?: (value: unknown) => void;
  onBlur?: () => void;
  currency?: string | null;
  readOnly?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * Renders a single field based on its FieldDefinition from the document type schema.
 * Handles different field types: text, number, currency, date, boolean, enum
 */
export function SchemaFieldRenderer({
  field,
  value,
  onChange,
  onBlur,
  currency,
  readOnly = false,
  className,
  "data-testid": dataTestId,
}: SchemaFieldRendererProps) {
  const t = useTranslations("documentPage");

  // Format display value based on field type
  const displayWidget = useMemo(() => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (field.name === "currency") {
      return getCurrencySymbol(value as string);
    } else {
      switch (field.type) {
        case "currency": {
          const numValue =
            typeof value === "string" ? parseFloat(value) : (value as number);
          const displayCurrency = field.currencyField ? currency : null;
          return (
            <FormatCurrency amount={numValue} currency={displayCurrency} />
          );
        }
        case "date": {
          const dateValue = value as string | Date;
          return <span>{formatDate(dateValue)}</span>;
        }
        case "boolean": {
          return <span>{value ? t("yes") : t("no")}</span>;
        }
        default:
          return undefined;
      }
    }
  }, [field, value, currency, t]);

  // Get input type for EditableField
  const getInputType = (): "text" | "number" | "date" => {
    switch (field.type) {
      case "number":
      case "currency":
        return "number";
      case "date":
        return "date";
      default:
        return "text";
    }
  };

  // Convert value to string for EditableField
  const stringValue = useMemo(() => {
    if (value === null || value === undefined) return "";
    if (field.type === "date" && value) {
      // Convert Date to ISO string for input
      if (value instanceof Date) {
        return value.toISOString().split("T")[0];
      }
      // If already a string, return as-is
      return String(value);
    }
    return String(value);
  }, [value, field.type]);

  // Handle value change and convert back to proper type
  const handleChange = (newValue: string) => {
    if (!onChange) return;

    let convertedValue: unknown = newValue;

    switch (field.type) {
      case "number":
      case "currency":
        convertedValue = newValue ? parseFloat(newValue) : null;
        break;
      case "boolean":
        convertedValue = newValue === "true";
        break;
      case "date":
        convertedValue = newValue || null;
        break;
      default:
        convertedValue = newValue || null;
    }

    onChange(convertedValue);
  };

  // For enum fields, render a select dropdown
  if (field.type === "enum" && field.enumValues) {
    return (
      <select
        value={stringValue}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        disabled={readOnly}
        className={`bg-transparent border-none text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 ${
          className || ""
        }`}
        data-testid={dataTestId}
      >
        <option value="">{t("selectOption")}</option>
        {field.enumValues.map((enumValue) => (
          <option key={enumValue} value={enumValue}>
            {enumValue}
          </option>
        ))}
      </select>
    );
  }

  // For boolean fields, render a checkbox
  if (field.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => {
          onChange?.(e.target.checked);
          // Trigger autosave immediately for checkbox changes
          onBlur?.();
        }}
        disabled={readOnly}
        className="rounded border-border"
        data-testid={dataTestId}
      />
    );
  }

  // For other fields, use EditableField
  return (
    <EditableField
      value={stringValue}
      onChange={handleChange}
      onBlur={onBlur}
      type={getInputType()}
      displayWidget={displayWidget}
      className={className}
      data-testid={dataTestId}
    />
  );
}

export default SchemaFieldRenderer;
