"use client";

import { useFieldEditDialog } from "./FieldEditDialogProvider";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Label } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import { Alert, AlertDescription } from "@zdocs/client-component";
import { Badge } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { BASE_FIELD_TYPES, DERIVED_FIELD_TYPES, FieldType } from "@zdocs/types";
import { FormulaSection } from "./FormulaSection";

export function CorePropertiesSection() {
  const { formData, setFormData } = useFieldEditDialog();
  const t = useTranslations("schema");

  if (!formData) return null;

  const isAiExtractable = formData.aiExtractable !== false;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <Label
            htmlFor="displayName"
            className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
          >
            {t("fieldName")}
          </Label>
          <Input
            id="displayName"
            className=" h-8"
            value={formData.displayName}
            onChange={(e) =>
              setFormData({
                ...formData,
                displayName: e.target.value,
              })
            }
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <Label
            htmlFor="name"
            className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
          >
            {t("technicalName")}
          </Label>
          <Input
            id="name"
            className="font-mono text-sm h-8"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5 w-36 flex-shrink-0">
          <Label
            htmlFor="type"
            className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
          >
            {t("fieldType")}
          </Label>
          <Select
            value={formData.type}
            onValueChange={(val) =>
              setFormData({ ...formData, type: val as FieldType })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASE_FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.toUpperCase()}
                </SelectItem>
              ))}
              {DERIVED_FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.type === "enum" && (
        <div
          className="space-y-2 pt-3 border-t border-border"
          data-testid="enum-values-section"
        >
          <Label className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">
            {t("enumValues")}
          </Label>
          <div
            className="flex flex-wrap gap-2"
            data-testid="enum-values-list"
          >
            {formData.enumValues?.map((val, idx) => (
              <Badge
                key={`${val}-${idx}`}
                variant="secondary"
                className="flex items-center gap-1 py-1 pr-1"
                data-testid={`enum-value-${idx}`}
              >
                {val}
                <button
                  onClick={() => {
                    const newList = [...(formData.enumValues || [])];
                    newList.splice(idx, 1);
                    setFormData({
                      ...formData,
                      enumValues: newList,
                    });
                  }}
                  className="hover:bg-destructive/20 rounded-full p-0.5"
                  data-testid={`enum-value-remove-${idx}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-32 text-xs"
                placeholder={t("addValue")}
                data-testid="enum-add-value-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      setFormData({
                        ...formData,
                        enumValues: [...(formData.enumValues || []), val],
                      });
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label
          htmlFor="description"
          className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
        >
          {t("description")}
        </Label>
        <Textarea
          id="description"
          className="min-h-[60px] text-sm"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              description: e.target.value,
            })
          }
          rows={2}
        />
      </div>

      {/* Formula config embedded for code fields */}
      {formData.type === "code" && (
        <div className="pt-3 border-t border-border">
          <FormulaSection />
        </div>
      )}

      {/* AI Extraction Section — hidden for code fields (computed, not extracted) */}
      {formData.type !== "code" && formData.type !== "sum" && <div className="space-y-3 pt-3 border-t border-border">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="aiExtractable"
            checked={isAiExtractable}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, aiExtractable: !!checked })
            }
          />
          <Label htmlFor="aiExtractable" className="text-sm font-medium">
            {t("aiExtractable")}
          </Label>
        </div>



        <div className="space-y-1.5">
          <Label
            htmlFor="extractionHint"
            className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
          >
            {t("extractionHint")}
          </Label>
          <Textarea
            id="extractionHint"
            className="min-h-[60px] text-sm"
            value={formData.extractionHint || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                extractionHint: e.target.value,
              })
            }
            disabled={!isAiExtractable}
            rows={2}
          />
        </div>
        <Alert className="bg-muted/50 py-2">
          <AlertDescription className="text-xs text-muted-foreground">
            {t("aiExtractableExplanation") ||
              "When enabled, AI will attempt to extract this field's value from documents. Use the description and extraction hint below to guide the AI extraction process."}
          </AlertDescription>
        </Alert>
      </div>}
    </div>
  );
}
