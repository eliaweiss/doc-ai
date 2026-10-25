"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { DryRunDocResult } from "../../../../utilities/api/dryRunFormula";
import { formatDate } from "@zdocs/util";

interface DryRunResultsProps {
  results: DryRunDocResult[];
}

function formatResult(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function ResultIcon({ result }: { result: DryRunDocResult }) {
  if (result.error) {
    return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  }
  if (result.notifications.some((n) => n.level === "error")) {
    return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  }
  if (result.notifications.some((n) => n.level === "warning")) {
    return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
  }
  return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
}

function DryRunResultRow({
  result,
  idx,
}: {
  result: DryRunDocResult;
  idx: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("schema");
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className="border-b border-border last:border-b-0"
      data-testid={`dry-run-result-${idx}`}
    >
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`dry-run-result-trigger-${idx}`}
      >
        <ChevronIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <ResultIcon result={result} />
        <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="truncate min-w-0">
          {result.fileName || result.documentId}
        </span>
        {result.documentDate && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDate(result.documentDate)}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground flex-shrink-0 font-mono">
          {result.error
            ? t("dryRunError")
            : formatResult(result.fieldResult).substring(0, 40)}
        </span>
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 pt-1 space-y-2"
          data-testid={`dry-run-result-details-${idx}`}
        >
          {result.error ? (
            <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded font-mono">
              {result.error}
            </div>
          ) : (
            <div data-testid={`dry-run-result-value-${idx}`}>
              <div className="text-xs text-muted-foreground mb-1">
                {t("dryRunResultLabel")}
              </div>
              <pre className="text-sm bg-muted p-2 rounded font-mono overflow-x-auto max-h-40">
                {formatResult(result.fieldResult)}
              </pre>
            </div>
          )}
          {result.notifications.length > 0 && (
            <div data-testid={`dry-run-result-notifications-${idx}`}>
              <div className="text-xs text-muted-foreground mb-1">
                {t("dryRunNotifications")}
              </div>
              <div className="space-y-1">
                {result.notifications.map((n, nIdx) => (
                  <div
                    key={nIdx}
                    className={`text-xs p-1.5 rounded flex gap-1.5 ${
                      n.level === "error"
                        ? "text-red-500 bg-red-500/10"
                        : n.level === "warning"
                        ? "text-yellow-500 bg-yellow-500/10"
                        : "text-blue-500 bg-blue-500/10"
                    }`}
                    data-testid={`dry-run-notification-${idx}-${nIdx}`}
                  >
                    <span className="font-medium uppercase">[{n.level}]</span>
                    <span>{n.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.logs.length > 0 && (
            <div data-testid={`dry-run-result-logs-${idx}`}>
              <div className="text-xs text-muted-foreground mb-1">
                {t("dryRunLogs")}
              </div>
              <div className="space-y-1">
                {result.logs.map((log, logIdx) => (
                  <div
                    key={logIdx}
                    className={`text-xs p-1.5 rounded flex gap-1.5 font-mono ${
                      log.level === "error"
                        ? "text-red-500 bg-red-500/10"
                        : log.level === "warn"
                          ? "text-yellow-500 bg-yellow-500/10"
                          : "text-muted-foreground bg-muted"
                    }`}
                    data-testid={`dry-run-log-${idx}-${logIdx}`}
                  >
                    <span className="font-medium uppercase">[{log.level}]</span>
                    <span className="text-[10px] text-muted-foreground">
                      {log.fieldPath}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DryRunResults({ results }: DryRunResultsProps) {
  const t = useTranslations("schema");

  if (!results.length) return null;

  return (
    <div
      className="border border-border rounded-md overflow-hidden"
      data-testid="dry-run-results"
    >
      <div
        className="px-3 py-2 bg-muted text-sm font-medium"
        data-testid="dry-run-results-header"
      >
        {t("dryRunResultsTitle", { count: results.length })}
      </div>
      {results.map((result, idx) => (
        <DryRunResultRow key={result.documentId} result={result} idx={idx} />
      ))}
    </div>
  );
}
