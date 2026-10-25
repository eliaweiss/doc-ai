"use client";

import { Play } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { useTranslations } from "next-intl";
import { useFieldEditDialog } from "./FieldEditDialogProvider";
import { useSchemaPage } from "../../context/SchemaPageProvider";
import { dryRunFormula } from "../../../../utilities/api/dryRunFormula";
import { DryRunResults } from "./DryRunResults";
import type { FormulaCode } from "@zdocs/types";
import { toast } from "sonner";

export function DryRunButton() {
  const {
    formData,
    editingField,
    dryRunResults,
    setDryRunResults,
    isDryRunning,
    setIsDryRunning,
  } = useFieldEditDialog();
  const { selectedSchema } = useSchemaPage();
  const t = useTranslations("schema");

  if (!formData || formData.type !== "code") return null;

  const formula = formData.formula as FormulaCode | undefined;
  const hasCode = !!formula?.code?.trim();

  const handleDryRun = async () => {
    if (!hasCode || !selectedSchema?.name || !formData.name) return;

    setIsDryRunning(true);
    setDryRunResults(null);
    try {
      const results = await dryRunFormula({
        docTypeName: selectedSchema.name,
        fieldName: formData.name,
        code: formula!.code,
        fieldType: formula!.fieldType || "text",
        collectionKey: editingField?.collectionKey || null,
      });
      setDryRunResults(results);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("dryRunFailed");
      toast.error(message);
    } finally {
      setIsDryRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full" data-testid="dry-run-section">
      <div className="flex justify-center" data-testid="dry-run-button-row">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDryRun}
          disabled={!hasCode || isDryRunning}
          data-testid="dry-run-button"
        >
          {isDryRunning ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
              {t("dryRunRunning")}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Play className="w-3 h-3" />
              {t("dryRunButton")}
            </span>
          )}
        </Button>
      </div>

      {dryRunResults && <DryRunResults results={dryRunResults} />}
    </div>
  );
}
