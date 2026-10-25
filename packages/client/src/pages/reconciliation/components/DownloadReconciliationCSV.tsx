"use client";

import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import type {
  EntityResponse,
  FieldDefinition,
  ReconciliationPairRef,
  ToleranceReconcileMapping,
} from "@zdocs/types";
import useOrgStore from "../../../context-providers/orgStore";
import { searchByEntityApi } from "../../../utilities/api/searchByEntity";
import { checkReconciliationStatus } from "../../../utilities/api/checkReconciliationStatus";
import { useReconciliation } from "../context/ReconciliationContext";
import { autoReconcile } from "../context/functions/autoReconcile";
import { buildReconciliationCSV } from "../utils/buildReconciliationCSV";

const MAX_DOWNLOAD_ITEMS = 1000;

export function DownloadReconciliationCSV() {
  const {
    sourceResults,
    targetResults,
    sourceSchema,
    targetSchema,
    reconciledPairs,
    fieldReconcileMapping,
    sourceEntity,
    sourceEntities,
    targetEntity,
    targetEntities,
    sourceQuery,
    targetQuery,
    hideReconciled,
    sharedDateFrom,
    sharedDateTo,
  } = useReconciliation();

  const { org } = useOrgStore();
  const t = useTranslations("reconciliation");

  const [isOpen, setIsOpen] = useState(false);
  const [onlyReconciled, setOnlyReconciled] = useState(true);
  const [onlyCurrentView, setOnlyCurrentView] = useState(true);
  const [onlyImportantFields, setOnlyImportantFields] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const hasData = sourceResults.length > 0 || targetResults.length > 0;

  const handleDownload = useCallback(async () => {
    if (!org?.id) return;
    setIsDownloading(true);

    try {
      let finalSourceResults: EntityResponse[] = sourceResults;
      let finalTargetResults: EntityResponse[] = targetResults;
      let finalReconciledPairs: ReconciliationPairRef[] = reconciledPairs;

      if (!onlyCurrentView) {
        const dateFrom = sharedDateFrom
          ? sharedDateFrom.toISOString().split("T")[0]
          : undefined;
        const dateTo = sharedDateTo
          ? sharedDateTo.toISOString().split("T")[0]
          : undefined;

        const [allSource, allTarget] = await Promise.all([
          fetchAllItems(
            org.id,
            sourceEntities,
            sourceQuery,
            hideReconciled,
            targetEntity,
            dateFrom,
            dateTo
          ),
          fetchAllItems(
            org.id,
            targetEntities,
            targetQuery,
            hideReconciled,
            sourceEntity,
            dateFrom,
            dateTo
          ),
        ]);

        finalSourceResults = allSource;
        finalTargetResults = allTarget;

        const sourceIds = allSource.map((r) => r.ref.entityId);
        const targetIds = allTarget.map((r) => r.ref.entityId);

        const [sourceLinks, targetLinks] = await Promise.all([
          targetEntity
            ? checkReconciliationStatus(
                org.id,
                sourceIds,
                targetEntity.schemaType,
                "source"
              )
            : Promise.resolve([]),
          sourceEntity
            ? checkReconciliationStatus(
                org.id,
                targetIds,
                sourceEntity.schemaType,
                "target"
              )
            : Promise.resolve([]),
        ]);

        const allLinks = [...sourceLinks, ...targetLinks];
        const seen = new Set<string>();
        finalReconciledPairs = allLinks
          .map((r) => ({
            sourceRef: r.sourceRef,
            targetRef: r.targetRef,
            amount: r.amount,
            currency: r.currency,
            date: r.date,
          }))
          .filter((pair) => {
            const key = `${pair.sourceRef.ref.entityId}-${pair.targetRef.ref.entityId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      }

      let allPairs: ReconciliationPairRef[] = [...finalReconciledPairs];

      if (!onlyReconciled) {
        const suggestedPairs = autoReconcile(
          finalSourceResults,
          finalTargetResults,
          sourceSchema,
          targetSchema,
          finalReconciledPairs,
          fieldReconcileMapping
        );
        allPairs.push(...suggestedPairs);
      }

      const sourceLabel = sourceEntities.map((e) => e.displayName).join(", ") || "Source";
      const targetLabel = targetEntities.map((e) => e.displayName).join(", ") || "Target";

      const csvContent = buildReconciliationCSV({
        sourceResults: finalSourceResults,
        targetResults: finalTargetResults,
        sourceSchema,
        targetSchema,
        pairs: allPairs,
        onlyReconciled,
        onlyImportantFields,
        sourceLabel,
        targetLabel,
      });

      downloadCSVFile(csvContent, `reconciliation_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
      toast.success(t("downloadComplete"));
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to download CSV:", error);
      toast.error(t("downloadFailed"));
    } finally {
      setIsDownloading(false);
    }
  }, [
    org?.id,
    sourceResults,
    targetResults,
    sourceSchema,
    targetSchema,
    reconciledPairs,
    fieldReconcileMapping,
    onlyCurrentView,
    onlyReconciled,
    onlyImportantFields,
    sourceEntities,
    sourceQuery,
    targetEntities,
    targetQuery,
    sourceEntity,
    targetEntity,
    hideReconciled,
    sharedDateFrom,
    sharedDateTo,
    t,
  ]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          disabled={!hasData}
          data-testid="download-reconciliation-csv-btn"
          title={t("downloadCSV")}
        >
          <Download className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72"
        align="end"
        data-testid="download-csv-popover"
      >
        <div className="flex flex-col gap-3" data-testid="download-csv-options">
          <p className="text-sm font-medium">{t("downloadCSVTitle")}</p>
          <div data-testid="download-csv-only-reconciled">
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-reconciled"
                checked={onlyReconciled}
                onCheckedChange={(checked) => setOnlyReconciled(checked === true)}
              />
              <label
                htmlFor="only-reconciled"
                className="text-sm cursor-pointer leading-none"
              >
                {t("onlyReconciled")}
              </label>
            </div>
            {!onlyReconciled && (
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {t("onlyReconciledHint")}
              </p>
            )}
          </div>
          <div data-testid="download-csv-only-current-view">
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-current-view"
                checked={onlyCurrentView}
                onCheckedChange={(checked) =>
                  setOnlyCurrentView(checked === true)
                }
              />
              <label
                htmlFor="only-current-view"
                className="text-sm cursor-pointer leading-none"
              >
                {t("onlyCurrentView")}
              </label>
            </div>
            {!onlyCurrentView && (
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {t("onlyCurrentViewHint")}
              </p>
            )}
          </div>
          <div data-testid="download-csv-only-important-fields">
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-important-fields"
                checked={onlyImportantFields}
                onCheckedChange={(checked) =>
                  setOnlyImportantFields(checked === true)
                }
              />
              <label
                htmlFor="only-important-fields"
                className="text-sm cursor-pointer leading-none"
              >
                {t("onlyImportantFields")}
              </label>
            </div>
            {!onlyImportantFields && (
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {t("onlyImportantFieldsHint")}
              </p>
            )}
          </div>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full"
            data-testid="download-csv-confirm-btn"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("downloading")}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t("downloadCSV")}
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

async function fetchAllItems(
  orgId: string,
  entities: { schemaType: string; displayName: string; schema?: FieldDefinition[] }[],
  query: string,
  excludeReconciled: boolean,
  opposingEntity: { schemaType: string; displayName: string } | null | undefined,
  dateFrom?: string,
  dateTo?: string
): Promise<EntityResponse[]> {
  const allResults: EntityResponse[] = [];

  for (const entity of entities) {
    let offset = 0;
    let hasMore = true;

    while (hasMore && allResults.length < MAX_DOWNLOAD_ITEMS) {
      const response = await searchByEntityApi(orgId, {
        entity: entity as any,
        query,
        offset,
        limit: 200,
        excludeReconciled,
        reconciliationTargetEntity: opposingEntity as any,
        dateFrom,
        dateTo,
      });

      for (const result of response.results) {
        allResults.push({
          ...result,
          data: {
            ...result.data,
            _entityDisplayName: entity.displayName,
          },
        });
      }

      hasMore = response.hasMore;
      offset += response.results.length;

      if (response.results.length === 0) break;
    }
  }

  return allResults.slice(0, MAX_DOWNLOAD_ITEMS);
}

function downloadCSVFile(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
