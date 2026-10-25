"use client";

import type { Organization } from "@zdocs/types";
import { useOrganizationSettings } from "../OrganizationSettingsProvider";
import { BasicInfoSection } from "./BasicInfoSection";
import { ProcessingSection } from "./ProcessingSection";

interface OrganizationSettingsContentProps {
  organization: Organization;
}

export function OrganizationSettingsContent({
  organization: _organization,
}: OrganizationSettingsContentProps) {
  const { selectedSection } = useOrganizationSettings();

  const renderContent = () => {
    switch (selectedSection) {
      case "basic":
        return <BasicInfoSection />;
      // doc-ai: no billing; local processing settings instead
      case "processing":
        return <ProcessingSection />;
      default:
        return <BasicInfoSection />;
    }
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      data-testid="org-settings-content"
    >
      {renderContent()}
    </div>
  );
}
