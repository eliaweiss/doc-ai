"use client";

import { useFieldEditDialog } from "./FieldEditDialogProvider";
import { CorePropertiesSection } from "./CorePropertiesSection";
import { FlagsSection } from "./FlagsSection";
import { DisplayAndBehaviorSection } from "./DisplayAndBehaviorSection";
import { FormulaSection } from "./FormulaSection";
import { CodeSection } from "./CodeSection";
import { useEffect } from "react";

export function FieldEditDialogContentArea() {
  const { selectedSection, formData } = useFieldEditDialog();




  if (!formData) return null;

  const renderContent = () => {
    switch (selectedSection) {
      case "coreProperties":
        return <CorePropertiesSection />;
      case "formula":
        return <FormulaSection />;
      case "code":
        return <CodeSection />;
      case "flags":
        return <FlagsSection />;
      case "displayAndBehavior":
        return <DisplayAndBehaviorSection />;
      default:
        return <CorePropertiesSection />;
    }
  };

  return (
    <div
      className={`flex-1 p-6 ${selectedSection === "code" ? "overflow-hidden" : "overflow-y-auto"
        }`}
      data-testid="field-edit-dialog-content-area"
    >
      <div
        className={selectedSection === "code" ? "h-full min-h-0" : ""}
        data-testid="field-edit-dialog-content-area-inner"
      >
        {renderContent()}
      </div>
    </div>
  );
}
