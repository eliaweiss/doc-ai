"use client";

import { useFieldEditDialog } from "./FieldEditDialogProvider";
import { useTranslations } from "next-intl";
import { Label } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";

export function DisplayAndBehaviorSection() {
  const { formData, setFormData } = useFieldEditDialog();
  const t = useTranslations("schema");

  if (!formData) return null;

  return (
    <div className="space-y-6">
      {/* Search & Display */}
      <div className="space-y-4" data-testid="search-and-display">
        <h3 className="text-sm font-semibold uppercase tracking-tight text-muted-foreground">
          {t("searchAndDisplay")}
        </h3>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-2 flex-[0_0_50%] min-w-[200px]">
            <Label
              htmlFor="pinned"
              className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
            >
              {t("pinned")}
            </Label>
            <Select
              value={formData.pinned || "none"}
              onValueChange={(val) =>
                setFormData({
                  ...formData,
                  pinned: val === "none" ? undefined : (val as any),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("pinNone")}</SelectItem>
                <SelectItem value="left">{t("pinLeft")}</SelectItem>
                <SelectItem value="right">{t("pinRight")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {formData.type === "currency" && (
          <div className="space-y-2">
            <Label
              htmlFor="currencyField"
              className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
            >
              {t("currencyField")}
            </Label>
            <Input
              id="currencyField"
              className="font-mono text-sm"
              value={formData.currencyField || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  currencyField: e.target.value,
                })
              }
            />
          </div>
        )}
      </div>

      {/* Denormalization */}
      <div className="space-y-4 pt-4 border-t border-border" data-testid="denormalization">
        <h3 className="text-sm font-semibold uppercase tracking-tight text-muted-foreground">
          {t("denormalization")}
        </h3>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("denormalizationExplanation")}
          </p>
          <div className="space-y-2">
            <Select
              value={formData.denormalizedAs || "none"}
              onValueChange={(val) =>
                setFormData({
                  ...formData,
                  denormalizedAs: val === "none" ? undefined : (val as any),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("denormNone")}</SelectItem>
                <SelectItem value="totalAmount">
                  {t("denormTotalAmount")}
                </SelectItem>
                <SelectItem value="date">{t("date")}</SelectItem>
                <SelectItem value="dueDate">{t("denormDueDate")}</SelectItem>
                <SelectItem value="description">
                  {t("denormDescription")}
                </SelectItem>
                <SelectItem value="currency">{t("denormCurrency")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Graph & Visualization - currently disabled
      <div className="space-y-4 pt-4 border-t border-border" data-testid="graph-and-visualization">
        <h3 className="text-sm font-semibold uppercase tracking-tight text-muted-foreground">
          {t("graphAndVisualization")}
        </h3>
        <div className="space-y-2">
          <Label
            htmlFor="axis"
            className="text-xs font-semibold uppercase tracking-tight text-muted-foreground"
          >
            {t("axis")}
          </Label>
          <Select
            value={formData.axis || "none"}
            onValueChange={(val) =>
              setFormData({
                ...formData,
                axis: val === "none" ? undefined : (val as any),
              })
            }
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("axisNone")}</SelectItem>
              <SelectItem value="both">{t("axisBoth")}</SelectItem>
              <SelectItem value="x">{t("axisX")}</SelectItem>
              <SelectItem value="y">{t("axisY")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>*/}
    </div>
  );
}
