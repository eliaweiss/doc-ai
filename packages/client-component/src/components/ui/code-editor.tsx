"use client";

import { cn } from "../../lib/utils";
import {
  type HTMLAttributes,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { type BundledLanguage, codeToHtml } from "shiki";

type CodeEditorProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  language?: BundledLanguage;
  placeholder?: string;
  readOnly?: boolean;
};

/**
 * Editable code editor with syntax highlighting.
 * Uses an overlay approach: transparent textarea for editing,
 * highlighted div underneath for display.
 */
export function CodeEditor({
  value,
  onChange,
  onBlur,
  language = "html",
  placeholder,
  readOnly = false,
  className,
  ...props
}: CodeEditorProps) {
  const [lightHtml, setLightHtml] = useState<string>("");
  const [darkHtml, setDarkHtml] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync scroll between textarea and highlight layer
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Highlight code with debouncing for performance
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        // Add a trailing newline to prevent last-line rendering issues
        const codeToHighlight = value || " ";

        const [light, dark] = await Promise.all([
          codeToHtml(codeToHighlight, {
            lang: language,
            theme: "one-light",
          }),
          codeToHtml(codeToHighlight, {
            lang: language,
            theme: "one-dark-pro",
          }),
        ]);

        setLightHtml(light);
        setDarkHtml(dark);
      } catch {
        // Fallback: just show plain text if highlighting fails
        const escaped = (value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const fallback = `<pre><code>${escaped}</code></pre>`;
        setLightHtml(fallback);
        setDarkHtml(fallback);
      }
    }, 100);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, language]);

  return (
    <div
      className={cn("relative w-full h-full font-mono text-sm", className)}
      data-testid="code-editor-container"
      {...props}
    >
      {/* Highlighted code layer (behind) */}
      <div
        ref={highlightRef}
        aria-hidden="true"
        className="absolute inset-0 overflow-auto pointer-events-none"
        data-testid="code-editor-highlight"
      >
        {/* Light mode */}
        <div
          className="dark:hidden min-h-full [&>pre]:m-0 [&>pre]:p-3 [&>pre]:min-h-full [&>pre]:bg-transparent! [&_code]:font-mono [&_code]:text-sm [&_code]:leading-relaxed"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "needed for syntax highlighting"
          dangerouslySetInnerHTML={{ __html: lightHtml }}
        />
        {/* Dark mode */}
        <div
          className="hidden dark:block min-h-full [&>pre]:m-0 [&>pre]:p-3 [&>pre]:min-h-full [&>pre]:bg-transparent! [&_code]:font-mono [&_code]:text-sm [&_code]:leading-relaxed"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "needed for syntax highlighting"
          dangerouslySetInnerHTML={{ __html: darkHtml }}
        />
      </div>

      {/* Editable textarea (on top, transparent) */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className={cn(
          "absolute inset-0 w-full h-full p-3 resize-none",
          "font-mono text-sm leading-relaxed",
          "bg-transparent text-transparent caret-foreground",
          "border-0 outline-none focus:ring-0",
          "overflow-auto whitespace-pre",
          readOnly && "cursor-default"
        )}
        style={{
          // Ensure textarea matches highlight layer exactly
          tabSize: 2,
          WebkitTextFillColor: "transparent",
        }}
        data-testid="code-editor-textarea"
        onBlur={() => onBlur?.(value)}
      />
    </div>
  );
}
