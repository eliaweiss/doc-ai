"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@zdocs/util";

interface MarkdownRendererProps {
  text: string;
  className?: string;
}

export function MarkdownRenderer({
  text,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:text-foreground",
        "prose-p:text-foreground",
        "prose-strong:text-foreground",
        "prose-em:text-foreground",
        "prose-code:text-foreground",
        "prose-pre:bg-muted prose-pre:text-foreground",
        "prose-blockquote:border-l-border prose-blockquote:text-muted-foreground",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-ul:text-foreground prose-ol:text-foreground",
        "prose-li:text-foreground",
        "prose-table:text-foreground",
        "prose-th:border-border prose-td:border-border",
        className
      )}
      data-testid="markdown-renderer"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{text}</ReactMarkdown>
    </div>
  );
}
