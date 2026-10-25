"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Terminal,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
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

interface TaskConsoleProps {
  output: string | null;
  outputData: Record<string, unknown> | null;
  error: string | null;
  isExecuting: boolean;
  onClear: () => void;
}

export function TaskConsole({
  output,
  outputData,
  error,
  isExecuting,
  onClear,
}: TaskConsoleProps) {
  const t = useTranslations("tasks");
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);

  // Auto-expand when execution starts
  useEffect(() => {
    if (isExecuting && isMinimized) {
      setIsMinimized(false);
    }
  }, [isExecuting, isMinimized]);

  // Auto-minimize when content is cleared
  useEffect(() => {
    if (!output && !error && !isExecuting) {
      setIsMinimized(true);
    }
  }, [output, error, isExecuting]);

  const getFullOutput = () => {
    let fullOutput = "";
    if (error) {
      fullOutput += `Error:\n${error}\n\n`;
    }
    if (output) {
      fullOutput += `Output:\n${output}\n\n`;
    }
    if (outputData && Object.keys(outputData).length > 0) {
      fullOutput += `Metadata:\n${JSON.stringify(outputData, null, 2)}`;
    }
    return fullOutput.trim();
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

  const hasContent = !!(output || error || isExecuting);

  const consoleContent = (
    <div className="space-y-4" data-testid="console-content">
      {/* Error Display */}
      {error && (
        <div
          className="p-3 rounded-md bg-destructive/10 border border-destructive/20"
          data-testid="console-error"
        >
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-1">
                {t("errorLabel") || "Error"}
              </p>
              <pre className="text-xs text-destructive font-mono whitespace-pre-wrap break-words">
                {error}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Output Display */}
      {output && (
        <div data-testid="console-output">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t("output") || "Output"}
          </p>
          <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-words bg-muted/50 p-3 rounded-md border border-border">
            {output}
          </pre>
        </div>
      )}

      {/* Output Data (Metadata) */}
      {outputData && Object.keys(outputData).length > 0 && (
        <div data-testid="console-metadata">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t("metadata") || "Metadata"}
          </p>
          <div className="bg-muted/50 p-3 rounded-md border border-border">
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-words">
              {JSON.stringify(outputData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Execution Status */}
      {isExecuting && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="console-executing"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t("executing") || "Executing..."}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        className={`flex flex-col border border-border rounded-md bg-background ${
          isMinimized ? "h-auto" : "h-[200px]"
        }`}
        data-testid="task-console"
      >
        {/* Console Header - Always visible */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {t("console") || "Console Output"}
            </span>
            {isExecuting && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
            {error && !isExecuting && (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            {!error && output && !isExecuting && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
            {/* Show preview when minimized and has content */}
            {isMinimized && hasContent && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {error
                  ? error.substring(0, 50) + (error.length > 50 ? "..." : "")
                  : output
                  ? output.substring(0, 50) + (output.length > 50 ? "..." : "")
                  : ""}
              </span>
            )}
            {/* Show empty hint when minimized and no content */}
            {isMinimized && !hasContent && (
              <span className="text-xs text-muted-foreground">
                {t("consoleEmpty") || "Click Execute to run your code"}
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
            {/* Clear button - only show when has output/error */}
            {(output || error) && (
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
                {t("console") || "Console Output"}
                {error && !isExecuting && (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                {!error && output && !isExecuting && (
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
