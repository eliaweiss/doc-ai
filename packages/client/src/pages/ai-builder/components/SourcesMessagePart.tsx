"use client";

import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "lucide-react";
import {
  useMessagePart,
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@zdocs/client-component";

type SourceUrlPart = {
  type: "source-url";
  sourceId: string;
  url: string;
  title?: string;
};

export function SourcesMessagePart() {
  const { message, partIndex } = useMessagePart();
  const t = useTranslations("aiDesk.sources");

  // Collect all source-url parts from the message
  const sourceParts = message.parts.filter(
    (part): part is SourceUrlPart => part.type === "source-url"
  );

  // Only render on the first source-url part to avoid duplicates
  const firstSourceIndex = message.parts.findIndex(
    (part) => part.type === "source-url"
  );
  if (partIndex !== firstSourceIndex) {
    return null;
  }

  if (sourceParts.length === 0) {
    return null;
  }

  return (
    <div data-testid="sources-message-part">
      <Sources>
        <SourcesTrigger count={sourceParts.length}>
          <p className="font-medium">
            {t("usedSources", { count: sourceParts.length })}
          </p>
          <ChevronDownIcon className="h-4 w-4" />
        </SourcesTrigger>
        <SourcesContent>
          {sourceParts.map((source) => (
            <Source
              key={source.sourceId}
              href={source.url}
              title={source.title || getDomainFromUrl(source.url)}
            />
          ))}
        </SourcesContent>
      </Sources>
    </div>
  );
}

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove 'www.' prefix if present
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
