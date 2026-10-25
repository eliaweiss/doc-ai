"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown,
  Clock,
  MessageSquare,
  Settings,
  Wrench,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zdocs/client-component";
import { LoadingDots } from "@zdocs/client-component";
import { fetchAiBuilderInteractions } from "../../../utilities/api/aiBuilderInteractionsApi";
import { useMiniApp } from "../context/MiniAppProvider";
import useOrgStore from "../../../context-providers/orgStore";
import JsonView from "react18-json-view";
import type { AiBuilderInteraction } from "@zdocs/types";
import { Button } from "@zdocs/client-component";

export function AiBuilderInteractionLog({
  autoLoad = false,
  onRefetchReady,
}: {
  autoLoad?: boolean;
  onRefetchReady?: (refetch: () => Promise<void>) => void;
}) {
  const { miniApp } = useMiniApp();
  const { org } = useOrgStore();
  const [interactions, setInteractions] = useState<AiBuilderInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(autoLoad);

  const loadInteractions = useCallback(async () => {
    if (!org?.id || !miniApp?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAiBuilderInteractions(org.id, miniApp.id);
      setInteractions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load interactions"
      );
    } finally {
      setIsLoading(false);
    }
  }, [org?.id, miniApp?.id]);

  useEffect(() => {
    if (autoLoad && org?.id && miniApp?.id && interactions.length === 0) {
      loadInteractions();
    } else if (isOpen && org?.id && miniApp?.id && interactions.length === 0) {
      loadInteractions();
    }
  }, [
    autoLoad,
    isOpen,
    org?.id,
    miniApp?.id,
    interactions.length,
    loadInteractions,
  ]);

  // Expose refetch function to parent component
  useEffect(() => {
    if (onRefetchReady) {
      onRefetchReady(async () => {
        // Clear existing interactions to force reload
        setInteractions([]);
        await loadInteractions();
      });
    }
  }, [onRefetchReady, loadInteractions]);

  const content = (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <LoadingDots message="Loading interactions..." />
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {error}
        </div>
      )}

      {!isLoading && !error && interactions.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No interactions logged yet
        </div>
      )}

      {!isLoading && !error && interactions.length > 0 && (
        <div className="space-y-3 flex  gap-2 flex-col-reverse">
          {interactions.map((interaction, index) => (
            <InteractionItem
              key={interaction.id}
              interaction={interaction}
              defaultOpen={index === interactions.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (autoLoad) {
    return content;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border bg-muted/20 rounded-lg overflow-hidden"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/40 hover:bg-muted/60 transition-colors group">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground">
            Interaction Log
          </span>
          {interactions.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({interactions.length})
            </span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {content}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InteractionItem({
  interaction,
  defaultOpen = false,
}: {
  interaction: AiBuilderInteraction;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCopied, setIsCopied] = useState(false);

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(d);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the collapsible

    try {
      const interactionJson = JSON.stringify(interaction, null, 2);
      await navigator.clipboard.writeText(interactionJson);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy interaction:", error);
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border rounded-md overflow-hidden bg-background"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {formatDate(interaction.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
            title="Copy interaction"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 space-y-4 border-t border-border">
        {/* System Prompt */}
        <Section
          title="System Prompt"
          icon={<Settings className="w-4 h-4" />}
          content={interaction.systemPrompt}
          isCode={false}
        />

        {/* Effective Messages */}
        <Section
          title="Effective Messages"
          icon={<MessageSquare className="w-4 h-4" />}
          content={interaction.effectiveMessages}
          isCode={true}
        />

        {/* Tools */}
        <Section
          title="Tools"
          icon={<Wrench className="w-4 h-4" />}
          content={interaction.tools}
          isCode={true}
        />

        {/* Result Messages */}
        <Section
          title="Result Messages"
          icon={<MessageSquare className="w-4 h-4" />}
          content={[...interaction.resultMessages]
            .map((message) => ({
              ...message,
              parts: message.parts?.map((part) => {
                const { callProviderMetadata, ...rest } = part as any;
                return rest;
              }),
            }))}
          isCode={true}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Custom component to render JSON with formatted descriptions
 * Post-processes the rendered HTML to convert \n sequences to line breaks in description fields
 */
function FormattedJsonView({ src }: { src: any }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Wait for JsonView to render, then process description fields
    const processDescriptions = () => {
      if (!containerRef.current) return;

      // Find all JSON pairs (key-value pairs)
      const pairs = containerRef.current.querySelectorAll(".json-view--pair");

      pairs.forEach((pair) => {
        // Find the key element
        const keyElement = pair.querySelector(".json-view--key");
        if (!keyElement) return;

        const keyText = keyElement.textContent?.trim() || "";
        // Check if this is a description field (handle both quoted and unquoted keys)
        if (
          keyText === '"description"' ||
          keyText === "description" ||
          keyText.includes("description")
        ) {
          // Find the string value element
          const stringElement = pair.querySelector(".json-view--string");
          if (stringElement) {
            const text = stringElement.textContent || "";
            // Check if it contains escaped newlines
            if (text.includes("\\n")) {
              // Replace \n with actual line breaks
              const formattedText = text.replace(/\\n/g, "\n");
              stringElement.textContent = formattedText;
              // Apply styles to preserve whitespace
              (stringElement as HTMLElement).style.whiteSpace = "pre-wrap";
              (stringElement as HTMLElement).style.wordBreak = "break-word";
              (stringElement as HTMLElement).style.maxWidth = "100%";
              (stringElement as HTMLElement).style.display = "block";
            }
          }
        }
      });
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(processDescriptions, 100);
    });
  }, [src]);

  return (
    <>
      <style>{`
        .json-view-formatted .json-view--string {
          white-space: pre-wrap !important;
          word-break: break-word !important;
          max-width: 100% !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className="bg-background rounded border overflow-hidden json-view-formatted"
      >
        <JsonView
          src={src}
          theme="default"
          collapsed={2}
          displaySize={true}
          enableClipboard={true}
          style={{
            padding: "12px",
            fontSize: "13px",
          }}
        />
      </div>
    </>
  );
}

function Section({
  title,
  icon,
  content,
  isCode,
}: {
  title: string;
  icon: React.ReactNode;
  content: any;
  isCode: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border rounded-md overflow-hidden bg-muted/20"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/40 transition-colors group">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
            {title}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 border-t border-border">
        {isCode ? (
          <FormattedJsonView src={content} />
        ) : (
          <div className="text-sm text-foreground whitespace-pre-wrap break-words bg-background p-3 rounded border">
            {typeof content === "string"
              ? content
              : JSON.stringify(content, null, 2)}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
