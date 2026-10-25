"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Terminal,
  X,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  XCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@zdocs/client-component";
import { ScrollArea } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { toast } from "sonner";

// Import and re-export ConsoleLog type from MiniAppViewer to avoid duplication
import type { ConsoleLog } from "../../../components/ui-tx/MiniAppViewer";
export type { ConsoleLog };

interface MiniAppConsoleProps {
  logs: ConsoleLog[];
  onClear: () => void;
}

function formatConsoleMessage(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }

  if (message instanceof Error) {
    return message.stack || message.message;
  }

  if (message === null) {
    return "null";
  }

  if (message === undefined) {
    return "undefined";
  }

  if (typeof message === "object") {
    const seen = new WeakSet<object>();

    try {
      return JSON.stringify(
        message,
        (_key, value) => {
          if (typeof value === "bigint") {
            return value.toString();
          }

          if (value instanceof Error) {
            return value.stack || value.message;
          }

          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }

            seen.add(value);
          }

          return value;
        },
        2
      );
    } catch {
      return String(message);
    }
  }

  return String(message);
}

export function MiniAppConsole({
  logs,
  onClear,
}: MiniAppConsoleProps) {
  const t = useTranslations("aiBuilder");
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);

  // Auto-expand when errors appear
  useEffect(() => {
    const hasErrors = logs.some((log) => log.type === "error");
    if (hasErrors && isMinimized) {
      setIsMinimized(false);
    }
  }, [logs, isMinimized]);

  // Auto-minimize when content is cleared
  useEffect(() => {
    if (logs.length === 0) {
      setIsMinimized(true);
    }
  }, [logs]);

  const getFullOutput = () => {
    return logs
      .map((log) => {
        const prefix = log.type === "error" ? "Error" : log.type === "warn" ? "Warning" : "Log";
        return `[${prefix}] ${formatConsoleMessage(log.message)}`;
      })
      .join("\n");
  };

  const handleCopy = async () => {
    const fullOutput = getFullOutput();
    if (!fullOutput) return;

    try {
      await navigator.clipboard.writeText(fullOutput);
      setCopied(true);
      toast.success(t("copiedToClipboard") || "Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed") || "Failed to copy");
    }
  };

  const hasContent = logs.length > 0;
  const hasErrors = logs.some((log) => log.type === "error");

  const consoleContent = (
    <div className="space-y-2" data-testid="console-content">
      {logs.map((log, index) => (
        <div
          key={index}
          className={`p-3 rounded-md border ${
            log.type === "error"
              ? "bg-destructive/10 border-destructive/20"
              : log.type === "warn"
              ? "bg-yellow-500/10 border-yellow-500/20"
              : "bg-muted/50 border-border"
          }`}
          data-testid={`console-log-${log.type}`}
        >
          <div className="flex items-start gap-2">
            {log.type === "error" && (
              <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            )}
            {log.type === "warn" && (
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-words mt-1">
                {formatConsoleMessage(log.message)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div
        className={`flex flex-col border border-border rounded-md bg-background ${
          isMinimized ? "h-auto" : "h-[200px]"
        }`}
        data-testid="mini-app-console"
      >
        {/* Console Header - Always visible */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {t("console") || "Console"}
            </span>
            {hasErrors && (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            {!hasErrors && hasContent && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
            {/* Show preview when minimized and has content */}
            {isMinimized && hasContent && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {formatConsoleMessage(logs[logs.length - 1]?.message).substring(0, 50)}
                {formatConsoleMessage(logs[logs.length - 1]?.message).length > 50 ? "..." : ""}
              </span>
            )}
            {/* Show empty hint when minimized and no content */}
            {isMinimized && !hasContent && (
              <span className="text-xs text-muted-foreground">
                {t("consoleEmpty") || "No errors or logs"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Minimize/Maximize button - only show when has content */}
            {hasContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                data-testid="console-minimize-btn"
                title={
                  isMinimized
                    ? t("maximizeConsole") || "Maximize console"
                    : t("minimizeConsole") || "Minimize console"
                }
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </Button>
            )}
            {/* Copy and Enlarge buttons - only show when expanded and has content */}
            {!isMinimized && hasContent && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  data-testid="console-copy-btn"
                  title={t("copyOutput") || "Copy output"}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                  data-testid="console-expand-btn"
                  title={t("expandConsole") || "Expand console"}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </>
            )}
            {/* Clear button - only show when has content */}
            {hasContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                data-testid="console-clear-btn"
                title={t("clearConsole") || "Clear console"}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Console Content - only show when expanded */}
        {!isMinimized && (
          <ScrollArea className="flex-1 p-4">{consoleContent}</ScrollArea>
        )}
      </div>

      {/* Expanded Console Dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent
          className="max-w-4xl w-[90vw] h-[80vh] flex flex-col"
          data-testid="console-expanded-dialog"
        >
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-muted-foreground" />
                {t("console") || "Console"}
                {hasErrors && (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                {!hasErrors && hasContent && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                data-testid="console-expanded-copy-btn"
                className="mr-8"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span className="ml-2">{t("copyOutput") || "Copy output"}</span>
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 p-4 border border-border rounded-md bg-muted/30">
            {consoleContent}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
