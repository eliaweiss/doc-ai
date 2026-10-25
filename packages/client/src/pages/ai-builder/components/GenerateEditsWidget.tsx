"use client";

import { useState, useRef, useEffect } from "react";
import { UIToolInvocation } from "ai";
import { useTranslations } from "next-intl";
import {
  useMessagePart,
  GenCodeBlock,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import type { EditOp } from "@zdocs/types";
import { cn } from "@zdocs/util";
import { useTheme } from "../../../hooks/useTheme";

function formatEditText(text: string | string[] | undefined): string {
  if (!text) return "";
  if (Array.isArray(text)) {
    return text.join("\n");
  }
  return text;
}

function EditDiffDisplay({ edit }: { edit: EditOp }) {
  const t = useTranslations("aiBuilder.generateEdit");
  const oldText =
    edit.type === "replace" || edit.type === "delete"
      ? formatEditText(edit.old)
      : null;
  const newText =
    edit.type === "replace" ||
      edit.type === "insert_before" ||
      edit.type === "insert_after"
      ? formatEditText(edit.new)
      : null;

  return (
    <div>
      {/* Reason if provided */}
      {edit.reason && (
        <div>
          <span className="">{edit.reason}</span>
        </div>
      )}
      <div
        className={cn(
          "space-y-2 bottom-1 border p-1 rounded-md flex ",
          edit.type === "insert_before" ? "flex-col-reverse" : "flex-col"
        )}
        data-testid={`edit-diff-${edit.type}`}
      >
        {/* Anchor */}
        {edit.type !== "replace" && (
          <div className="">
            <GenCodeBlock code={edit.anchor} language="js" />
            {edit.occurrence !== undefined && edit.occurrence > 0 && (
              <span className="ml-2">
                ({t("occurrence", { count: edit.occurrence })})
              </span>
            )}
          </div>
        )}

        {/* Diff display */}
        <div className="space-y-1">
          {oldText && (
            <div className="flex items-center gap-2 bg-red-100/50">
              <span className=" font-bold ">-</span>
              <div className="flex-1 min-w-0">
                <GenCodeBlock code={oldText} language="js" />
              </div>
            </div>
          )}
          {newText && (
            <div className="flex items-center gap-2 bg-green-100/50">
              <span className=" font-bold ">+</span>
              <div className="flex-1 min-w-0">
                <GenCodeBlock code={newText} language="js" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MAX_COLLAPSED_HEIGHT = 100;

export function GenerateEditsWidget() {
  const { part } = useMessagePart();
  const t = useTranslations("aiBuilder.generateEdit");
  const { isDark } = useTheme();
  const toolPart = part as UIToolInvocation<any>;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Single edit format - input is the edit object directly
  const edit = toolPart.input as EditOp | undefined;

  useEffect(() => {
    if (toolPart.state === "output-available") {
      console.log("part", toolPart);
    }
  }, [toolPart.state]);

  // Check if content overflows on mount and when edit changes
  useEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current) {
        const scrollHeight = contentRef.current.scrollHeight;
        setIsOverflowing(scrollHeight > MAX_COLLAPSED_HEIGHT);
      }
    };
    checkOverflow();
    const timer = setTimeout(checkOverflow, 100);
    return () => clearTimeout(timer);
  }, [edit]);

  if (!edit || !edit.anchor) {
    return null;
  }

  const showFade = isOverflowing && !isExpanded;

  return (
    <Card className="my-2" data-testid="generate-edits-widget">
      <CardHeader>
        <CardTitle className="text-sm">
          {t("singleTitle", { type: edit.type })}
        </CardTitle>
      </CardHeader>
      <div className="relative" data-testid="edits-container">
        <CardContent
          ref={contentRef}
          className="space-y-1"
          style={{
            maxHeight: isExpanded ? "none" : `${MAX_COLLAPSED_HEIGHT}px`,
            overflow: isExpanded ? "visible" : "hidden",
          }}
          data-testid="edits-content"
        >
          <EditDiffDisplay edit={edit} />
        </CardContent>
        {showFade && (
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={() => setIsExpanded(true)}
            data-testid="expand-fade-overlay"
            style={{
              background:
                isDark
                  ? "linear-gradient(to bottom, transparent 10%, black 100%)"
                  : "linear-gradient(to bottom, transparent 10%, white 100%)",
            }}
          />
        )}
      </div>
    </Card>
  );
}
