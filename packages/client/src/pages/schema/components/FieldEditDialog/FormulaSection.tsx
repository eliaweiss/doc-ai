"use client";

import { useFieldEditDialog } from "./FieldEditDialogProvider";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Label } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Badge } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { FormulaSum, FormulaCode, BaseFieldType, BASE_FIELD_TYPES } from "@zdocs/types";

export function FormulaSection() {
  const { formData, setFormData } = useFieldEditDialog();
  const t = useTranslations("schema");

  if (!formData) return null;

  // Only show for derived field types (sum, code)
  if (formData.type !== "sum" && formData.type !== "code") {
    return null;
  }

  const isSum = formData.type === "sum";
  const isCode = formData.type === "code";

  const formula = formData.formula as FormulaSum | FormulaCode | undefined;

  const updateFormula = (updates: Partial<FormulaSum | FormulaCode>) => {
    const currentFormula = formData.formula || {
      fieldType: "number" as BaseFieldType,
      ...(isSum ? { fieldPath: "" } : { inputFields: [], code: "" }),
    };
    setFormData({
      ...formData,
      formula: { ...currentFormula, ...updates } as FormulaSum | FormulaCode,
    });
  };

  return (
    <div className="space-y-6">
      {/* Output Field Type */}
      <div className="space-y-2">
        <Label
          htmlFor="formulaFieldType"
          className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
        >
          {t("formulaOutputType")}
        </Label>
        {isSum ? (
          <Select
            value={(formula as FormulaSum)?.fieldType || "number"}
            onValueChange={(val) =>
              updateFormula({ fieldType: val as "number" | "currency" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">NUMBER</SelectItem>
              <SelectItem value="currency">CURRENCY</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={formula?.fieldType || "text"}
            onValueChange={(val) =>
              updateFormula({ fieldType: val as BaseFieldType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASE_FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sum-specific fields */}
      {isSum && (
        <>
          <div className="space-y-2">
            <Label
              htmlFor="fieldPath"
              className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
            >
              {t("fieldPath")}
            </Label>
            <Input
              id="fieldPath"
              className="font-mono text-sm"
              placeholder="items.amount"
              value={(formula as FormulaSum)?.fieldPath || ""}
              onChange={(e) => updateFormula({ fieldPath: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("fieldPathHint")}
            </p>
          </div>

          {(formula as FormulaSum)?.fieldType === "currency" && (
            <div className="space-y-2">
              <Label
                htmlFor="currencyFieldPath"
                className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
              >
                {t("currencyFieldPath")}
              </Label>
              <Input
                id="currencyFieldPath"
                className="font-mono text-sm"
                placeholder="header.currency"
                value={(formula as FormulaSum)?.currencyFieldPath || ""}
                onChange={(e) =>
                  updateFormula({ currencyFieldPath: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("currencyFieldPathHint")}
              </p>
            </div>
          )}
        </>
      )}

      {/* Code-specific fields  - currently disabled
        {isCode && (
          <>
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                {t("inputFields")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {(formula as FormulaCode)?.inputFields?.map((field, idx) => (
                  <Badge
                    key={`${field}-${idx}`}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 pr-1 font-mono text-xs"
                  >
                    {field}
                    <button
                      onClick={() => {
                        const newList = [
                          ...((formula as FormulaCode)?.inputFields || []),
                        ];
                        newList.splice(idx, 1);
                        updateFormula({ inputFields: newList });
                      }}
                      className="hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  className="h-7 w-40 text-xs font-mono"
                  placeholder={t("addInputField")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        updateFormula({
                          inputFields: [
                            ...((formula as FormulaCode)?.inputFields || []),
                            val,
                          ],
                        });
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("inputFieldsHint")}
              </p>
            </div>

          </>
        )}*/}

      {/* Datasets (common to both)  - currently disabled
        <div className="space-y-3 pt-4 border-t border-border">
          <Label className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
            {t("datasets")}
          </Label>
          <div className="flex flex-wrap gap-2">
            {formula?.datasets?.map((dataset, idx) => (
              <Badge
                key={`${dataset}-${idx}`}
                variant="secondary"
                className="flex items-center gap-1 py-1 pr-1"
              >
                {dataset}
                <button
                  onClick={() => {
                    const newList = [...(formula?.datasets || [])];
                    newList.splice(idx, 1);
                    updateFormula({ datasets: newList });
                  }}
                  className="hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Input
              className="h-7 w-40 text-xs"
              placeholder={t("addDataset")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.currentTarget.value.trim();
                  if (val) {
                    updateFormula({
                      datasets: [...(formula?.datasets || []), val],
                    });
                    e.currentTarget.value = "";
                  }
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("datasetsHint")}</p>
        </div>*/}
    </div>
  );
}

