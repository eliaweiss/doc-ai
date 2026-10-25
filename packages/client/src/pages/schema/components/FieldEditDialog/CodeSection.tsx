"use client";

import { useEffect, useState, useRef } from "react";
import { useFieldEditDialog } from "./FieldEditDialogProvider";
import { useTranslations } from "next-intl";
import {
  CodeEditor,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@zdocs/client-component";
import { FormulaCode } from "@zdocs/types";
import { FormulaCodeChatProvider } from "./FormulaCodeChatProvider";
import { FormulaCodeChatPane } from "./FormulaCodeChatPane";
import { DryRunButton } from "./DryRunButton";

export function CodeSection() {
  const { formData, setFormData, saveData, selectedSection, setShowDialogFooter } = useFieldEditDialog();
  const t = useTranslations("schema");
  const [activeTab, setActiveTab] = useState("ai");
  const isDirtyRef = useRef(false);
  const previousTabRef = useRef("ai");

  useEffect(() => {
    if (selectedSection == "code" && activeTab == "ai") {
      setShowDialogFooter(false);
    } else {
      setShowDialogFooter(true);
    }
  }, [selectedSection, activeTab]);

  // Save when switching away from the editor tab, only if code changed
  useEffect(() => {
    if (previousTabRef.current === "editor" && activeTab !== "editor" && isDirtyRef.current) {
      saveData().then(() => { isDirtyRef.current = false; });
    }
    previousTabRef.current = activeTab;
  }, [activeTab, saveData]);

  if (!formData) return null;

  if (formData.type !== "code") {
    return null;
  }

  const formula = formData.formula as FormulaCode | undefined;

  const updateFormula = (updates: Partial<FormulaCode>) => {
    const currentFormula = formData.formula || {
      fieldType: "text",
      inputFields: [],
      code: "",
    };
    setFormData({
      ...formData,
      formula: { ...currentFormula, ...updates } as FormulaCode,
    });
  };

  return (
    <FormulaCodeChatProvider>

      <div
        className="h-full min-h-0 flex flex-col gap-2"
        data-testid="code-section"
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full h-full min-h-0 flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="ai" data-testid="code-tab-ai">
              {t("aiCodeGenerator")}
            </TabsTrigger>
            <TabsTrigger value="editor" data-testid="code-tab-editor">
              {t("codeEditor")}
            </TabsTrigger>
            <TabsTrigger value="dryRun" data-testid="code-tab-dry-run">
              {t("dryRunTab")}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="editor"
            className="mt-2 flex-1 min-h-0 overflow-y-auto"
          >
            <div
              className="flex flex-col gap-2"
              data-testid="code-section-editor-layout"
            >
              <div
                className="relative border border-input rounded-md overflow-hidden"
                data-testid="code-section-editor-container"
              >
                <CodeEditor
                  id="code"
                  language="javascript"
                  placeholder="// JavaScript function body"
                  value={formula?.code || ""}
                  onChange={(value) => { isDirtyRef.current = true; updateFormula({ code: value }); }}
                  className="min-h-[40vh] overflow-auto"
                  data-testid="code-section-editor"
                  onBlur={() => {
                    if (isDirtyRef.current) {
                      saveData().then(() => { isDirtyRef.current = false; });
                    }
                  }}
                />
              </div>
              <div
                className="flex flex-col gap-2"
                data-testid="code-section-editor-footer"
              >
                <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
              </div>
            </div>
          </TabsContent>
          <TabsContent
            value="ai"
            className="mt-2 flex-1 min-h-0 overflow-hidden"
          >
            <div
              className="relative border border-input rounded-md overflow-hidden h-full min-h-0"
              data-testid="code-section-ai-generator"
            >
              <FormulaCodeChatPane />
            </div>
          </TabsContent>
          <TabsContent
            value="dryRun"
            className="mt-2 flex-1 min-h-0 overflow-y-auto"
            data-testid="code-section-dry-run-tab"
          >
            <div
              className="flex flex-col gap-3"
              data-testid="code-section-dry-run-layout"
            >
              <p
                className="text-xs text-muted-foreground"
                data-testid="code-section-dry-run-hint"
              >
                {t("dryRunTabHint")}
              </p>
              <DryRunButton />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </FormulaCodeChatProvider>

  );
}

