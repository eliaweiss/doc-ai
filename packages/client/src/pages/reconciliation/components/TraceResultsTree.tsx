"use client";

import { useState, useMemo } from "react";
import type {
  TraceResponse,
  MoneyFlowChain,
  MoneyFlowLink,
  ReconciliationObjRef,
} from "@zdocs/types";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatDate } from "@zdocs/util";
import { useTranslations } from "next-intl";
import FormatCurrency from "../../document/components/FormatCurrency";
import useOrgStore from "../../../context-providers/orgStore";

// Schema field definition
interface SchemaField {
  name: string;
  displayName: string;
  isImportant?: boolean;
  isReconcilable?: boolean;
  type?: string;
}

interface TraceResultsTreeProps {
  results: TraceResponse;
  schemaTypeToDisplayName: Record<string, string>;
  endSchemaTypes: string[];
  entitySchemas: Array<{ schemaType: string; schema?: SchemaField[] }>;
}

export function TraceResultsTree({
  results,
  schemaTypeToDisplayName,
  endSchemaTypes,
  entitySchemas,
}: TraceResultsTreeProps) {
  const t = useTranslations("reconciliation.trace");

  // Helper to get display name for a schema type
  const getDisplayName = (schemaType: string) => {
    return schemaTypeToDisplayName[schemaType] || schemaType;
  };

  // Create a map from schemaType to its important/reconcilable fields
  const schemaFieldsMap = useMemo(() => {
    const map: Record<string, SchemaField[]> = {};
    for (const entity of entitySchemas) {
      if (entity.schema) {
        // Filter to only important or reconcilable fields
        map[entity.schemaType] = entity.schema.filter(
          (f) => f.isImportant || f.isReconcilable
        );
      }
    }
    return map;
  }, [entitySchemas]);

  // Helper to check if a chain contains any of the end schema types (client-side matching)
  const chainContainsEndEntity = (chain: MoneyFlowChain): boolean => {
    if (endSchemaTypes.length === 0) return false;
    return chain.links.some(
      (link) =>
        endSchemaTypes.includes(link.sourceRef.ref.schemaType) ||
        endSchemaTypes.includes(link.targetRef.ref.schemaType)
    );
  };

  // Count matching paths client-side
  const matchingPaths = results.chains.filter(chainContainsEndEntity).length;

  if (results.chains.length === 0) {
    return (
      <div
        className="p-8 text-center text-muted-foreground"
        data-testid="trace-no-chains"
      >
        {t("noChains")}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6" data-testid="trace-results-tree">
      {/* Summary */}
      <div
        className="flex flex-wrap gap-4 bg-muted/30 p-3 rounded-md border"
        data-testid="trace-summary"
      >
        <div
          className="flex items-center gap-1"
          data-testid="trace-summary-total"
        >
          {t("summary.chainsFound", { count: results.summary.totalPaths })}
        </div>
        {matchingPaths > 0 && (
          <div
            className="flex items-center gap-1 text-green-600"
            data-testid="trace-summary-matching"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t("summary.matchingTarget", {
              count: matchingPaths,
            })}
          </div>
        )}
        <div
          className="flex items-center gap-1"
          data-testid="trace-summary-max-depth"
        >
          {t("summary.maxDepth", { depth: results.summary.maxDepthReached })}
        </div>
        {results.summary.truncated && (
          <div
            className="flex items-center gap-1 text-yellow-600"
            data-testid="trace-summary-truncated"
          >
            <AlertTriangle className="w-4 h-4" />
            {t("summary.truncated")}
          </div>
        )}
      </div>

      {/* Chains */}
      <div className="space-y-4" data-testid="trace-chains-list">
        {results.chains.map((chain) => (
          <ChainNode
            key={chain.startEntityId}
            chain={chain}
            getDisplayName={getDisplayName}
            endsAtTarget={chainContainsEndEntity(chain)}
            schemaFieldsMap={schemaFieldsMap}
          />
        ))}
      </div>
    </div>
  );
}

function ChainNode({
  chain,
  getDisplayName,
  endsAtTarget,
  schemaFieldsMap,
}: {
  chain: MoneyFlowChain;
  getDisplayName: (schemaType: string) => string;
  endsAtTarget: boolean;
  schemaFieldsMap: Record<string, SchemaField[]>;
}) {
  const t = useTranslations("reconciliation.trace.summary");
  const tTrace = useTranslations("reconciliation.trace");
  const [expanded, setExpanded] = useState(true);

  // The first link in the links array is depth 0
  const rootLink = chain.links.find((l) => l.depth === 0);
  if (!rootLink) return null;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        endsAtTarget
          ? "border-green-400 bg-green-50/20 shadow-sm"
          : "border-border"
      )}
      data-testid={`trace-chain-${chain.startEntityId}`}
    >
      <div
        className={cn(
          "flex items-center gap-2 p-3 cursor-pointer hover:bg-accent/50 transition-colors",
          endsAtTarget ? "bg-green-100/30" : "bg-muted/30"
        )}
        onClick={() => setExpanded(!expanded)}
        data-testid={`trace-chain-header-${chain.startEntityId}`}
      >
        <div
          className="p-0.5 hover:bg-accent rounded"
          data-testid={`trace-chain-toggle-${chain.startEntityId}`}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
        <div
          className="flex-1 flex items-center justify-between"
          data-testid={`trace-chain-header-body-${chain.startEntityId}`}
        >
          <div
            className="flex items-center gap-2 overflow-hidden"
            data-testid={`trace-chain-header-left-${chain.startEntityId}`}
          >
            <span className="font-bold whitespace-nowrap text-sm">
              {getDisplayName(rootLink.sourceRef.ref.schemaType) ||
                tTrace("unknownEntity")}
            </span>
            <span className="text-sm text-muted-foreground truncate max-w-[300px]">
              {rootLink.sourceRef.field.description}
            </span>
            {rootLink.sourceRef.ref.date && (
              <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                {formatDate(rootLink.sourceRef.ref.date)}
              </span>
            )}
            {endsAtTarget && (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            )}
          </div>
          <div
            className="text-xs font-medium text-muted-foreground flex items-center gap-3"
            data-testid={`trace-chain-header-right-${chain.startEntityId}`}
          >
            <span>{t("links", { count: chain.links.length })}</span>
            <span>{t("depth", { depth: chain.totalDepth })}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div
          className="p-3 pl-6 border-t border-dashed bg-card/50"
          data-testid={`trace-chain-links-${chain.startEntityId}`}
        >
          <LinkLevel
            chainStartEntityId={chain.startEntityId}
            links={chain.links}
            parentPath={[]}
            depth={0}
            getDisplayName={getDisplayName}
            schemaFieldsMap={schemaFieldsMap}
          />
        </div>
      )}
    </div>
  );
}

// Helper to extract entity data from document data
function extractEntityData(
  ref: ReconciliationObjRef,
  docData: {
    headerData?: Record<string, unknown>;
    lineItems?: Record<string, Record<string, unknown>[]> | null;
  }
): Record<string, unknown> | null {
  if (ref.ref.entityType === "HEADER") {
    return docData.headerData || null;
  }
  // For line items, find the specific item by entityId
  if (ref.ref.collectionKey && docData.lineItems) {
    const collection = docData.lineItems[ref.ref.collectionKey];
    if (Array.isArray(collection)) {
      // entityId format: "{documentId}_{collectionKey}_{index}"
      const parts = ref.ref.entityId.split("_");
      const index = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(index) && collection[index]) {
        return collection[index];
      }
    }
  }
  return null;
}

// Helper to format a value for display
function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "string") {
    // Check if it's a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return formatDate(value);
    }
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Component to display entity details
function EntityDetailCard({
  label,
  ref_,
  entityData,
  displayName,
  description,
  date,
  linkId,
  viewDocumentLabel,
  schemaFields,
}: {
  label: string;
  ref_: ReconciliationObjRef;
  entityData: Record<string, unknown> | null;
  displayName: string;
  description?: string;
  date?: string;
  linkId: string;
  viewDocumentLabel: string;
  schemaFields?: SchemaField[];
}) {
  // Filter entity data to only show important/reconcilable fields
  const fieldsToShow = useMemo(() => {
    if (!entityData || !schemaFields || schemaFields.length === 0) {
      return [];
    }
    return schemaFields
      .filter(
        (field) =>
          entityData[field.name] !== undefined &&
          entityData[field.name] !== null
      )
      .map((field) => ({
        name: field.name,
        displayName: field.displayName,
        value: entityData[field.name],
        isReconcilable: field.isReconcilable,
      }));
  }, [entityData, schemaFields]);

  return (
    <div
      className="space-y-2"
      data-testid={`trace-link-${label.toLowerCase()}-${linkId}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-muted-foreground uppercase text-xs">
          {label}
        </div>
        <a
          href={`/document/${ref_.ref.documentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
          onClick={(e) => e.stopPropagation()}
          data-testid={`trace-link-${label.toLowerCase()}-doc-${linkId}`}
        >
          {viewDocumentLabel}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-bold text-sm">{displayName}</span>
        {description && (
          <span className="text-sm text-muted-foreground">{description}</span>
        )}
        {date && (
          <span className="text-sm text-muted-foreground">
            • {formatDate(date)}
          </span>
        )}
      </div>

      {/* Entity Data Fields - only important/reconcilable fields */}
      {fieldsToShow.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 p-2 bg-background/50 rounded border border-border/50">
          {fieldsToShow.map((field) => (
            <div key={field.name} className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                {field.displayName}
              </span>
              <span
                className="text-sm font-medium truncate"
                title={formatValue(field.name, field.value)}
              >
                {formatValue(field.name, field.value)}
              </span>
            </div>
          ))}
        </div>
      ) : entityData ? (
        <div className="text-sm text-muted-foreground italic">
          No important fields available
        </div>
      ) : (
        <div className="text-sm text-muted-foreground font-mono">
          ID: {ref_.ref.entityId}
        </div>
      )}
    </div>
  );
}

function LinkLevel({
  chainStartEntityId,
  links,
  parentPath,
  depth,
  getDisplayName,
  schemaFieldsMap,
}: {
  chainStartEntityId: string;
  links: MoneyFlowLink[];
  parentPath: string[];
  depth: number;
  getDisplayName: (schemaType: string) => string;
  schemaFieldsMap: Record<string, SchemaField[]>;
}) {
  const t = useTranslations("reconciliation.trace.tree");
  const { org } = useOrgStore();
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [entityDataCache, setEntityDataCache] = useState<
    Record<
      string,
      {
        source: Record<string, unknown> | null;
        target: Record<string, unknown> | null;
      }
    >
  >({});
  const [loadingLinkId, setLoadingLinkId] = useState<string | null>(null);

  // Find links at this depth that belong to the current branch
  const levelLinks = links.filter(
    (l) =>
      l.depth === depth &&
      (parentPath.length === 0 ||
        (l.path.length > depth &&
          l.path.slice(0, depth).every((id, i) => id === parentPath[i])))
  );

  if (levelLinks.length === 0) return null;

  const parentKey = parentPath.length > 0 ? parentPath.join("_") : "root";

  const toggleExpand = async (link: MoneyFlowLink) => {
    if (expandedLinkId === link.id) {
      setExpandedLinkId(null);
      return;
    }

    setExpandedLinkId(link.id);

    // Fetch entity data if not cached
    if (!entityDataCache[link.id] && org?.id) {
      setLoadingLinkId(link.id);
      try {
        // Fetch source and target document data
        const [sourceRes, targetRes] = await Promise.all([
          fetch(
            `/api/org/${org.id}/documents/${link.sourceRef.ref.documentId}/get-doc`
          ),
          fetch(
            `/api/org/${org.id}/documents/${link.targetRef.ref.documentId}/get-doc`
          ),
        ]);

        const sourceData = sourceRes.ok ? await sourceRes.json() : null;
        const targetData = targetRes.ok ? await targetRes.json() : null;

        setEntityDataCache((prev) => ({
          ...prev,
          [link.id]: {
            source: sourceData
              ? extractEntityData(link.sourceRef, sourceData)
              : null,
            target: targetData
              ? extractEntityData(link.targetRef, targetData)
              : null,
          },
        }));
      } catch (error) {
        console.error("Failed to fetch entity data:", error);
      } finally {
        setLoadingLinkId(null);
      }
    }
  };

  return (
    <div
      className="space-y-3 relative"
      data-testid={`trace-link-level-${chainStartEntityId}-${depth}-${parentKey}`}
    >
      {levelLinks.map((link) => (
        <div
          key={link.id}
          className="relative"
          data-testid={`trace-link-${link.id}`}
        >
          {/* Vertical line indicator for hierarchy */}
          {depth >= 0 && (
            <div
              className="absolute -left-3 top-0 bottom-0 w-px bg-border/50"
              data-testid={`trace-link-line-${link.id}`}
            />
          )}

          <div
            className="flex flex-col gap-1 py-1"
            data-testid={`trace-link-body-${link.id}`}
          >
            <div
              className="flex items-center gap-2 group cursor-pointer hover:bg-accent/30 rounded px-1 -mx-1 transition-colors"
              onClick={() => toggleExpand(link)}
              data-testid={`trace-link-row-${link.id}`}
            >
              <span className="text-muted-foreground/50">
                {expandedLinkId === link.id ? "▼" : "└─"}
              </span>

              <span className="font-bold text-sm">
                {getDisplayName(link.targetRef.ref.schemaType)}
              </span>
              <span
                className="text-sm text-muted-foreground truncate max-w-[250px]"
                title={link.targetRef.field.description}
              >
                {link.targetRef.field.description}
              </span>
              {link.targetRef.ref.date && (
                <span className="text-xs text-muted-foreground">
                  ({formatDate(link.targetRef.ref.date)})
                </span>
              )}
              <div
                className="flex-1 border-b border-dotted border-border/50 mx-2 mb-1"
                data-testid={`trace-link-divider-${link.id}`}
              />
              <div
                className="font-mono font-semibold text-sm whitespace-nowrap bg-background px-1.5 py-0.5 rounded border border-border/50 shadow-xs"
                data-testid={`trace-link-amount-${link.id}`}
              >
                <FormatCurrency amount={link.amount} currency={link.currency} />
              </div>
            </div>

            {/* Expanded detail view */}
            {expandedLinkId === link.id && (
              <div
                className="ml-6 mt-2 p-3 bg-muted/30 rounded-md border text-sm space-y-4"
                data-testid={`trace-link-details-${link.id}`}
              >
                {loadingLinkId === link.id ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Source Entity */}
                    <EntityDetailCard
                      label={t("source")}
                      ref_={link.sourceRef}
                      entityData={entityDataCache[link.id]?.source}
                      displayName={getDisplayName(link.sourceRef.ref.schemaType)}
                      description={link.sourceRef.field.description}
                      date={link.sourceRef.ref.date}
                      linkId={link.id}
                      viewDocumentLabel={t("viewDocument")}
                      schemaFields={schemaFieldsMap[link.sourceRef.ref.schemaType]}
                    />

                    {/* Arrow */}
                    <div className="flex items-center justify-center text-muted-foreground">
                      <span className="text-lg">↓</span>
                      <span className="ml-2 font-mono">
                        <FormatCurrency
                          amount={link.amount}
                          currency={link.currency}
                        />
                      </span>
                    </div>

                    {/* Target Entity */}
                    <EntityDetailCard
                      label={t("target")}
                      ref_={link.targetRef}
                      entityData={entityDataCache[link.id]?.target}
                      displayName={getDisplayName(link.targetRef.ref.schemaType)}
                      description={link.targetRef.field.description}
                      date={link.targetRef.ref.date}
                      linkId={link.id}
                      viewDocumentLabel={t("viewDocument")}
                      schemaFields={schemaFieldsMap[link.targetRef.ref.schemaType]}
                    />
                  </>
                )}
              </div>
            )}

            {/* Recursively render next level */}
            <div
              className="pl-4"
              data-testid={`trace-link-children-${link.id}`}
            >
              <LinkLevel
                chainStartEntityId={chainStartEntityId}
                links={links}
                parentPath={link.path || []}
                getDisplayName={getDisplayName}
                schemaFieldsMap={schemaFieldsMap}
                depth={depth + 1}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
