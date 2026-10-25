"use client";

import { useEffect } from "react";
import type { Organization } from "@zdocs/types";
import { cn } from "@zdocs/util";
import { OrganizationSettingsSidebar } from "./components/OrganizationSettingsSidebar";
import { OrganizationSettingsContent } from "./components/OrganizationSettingsContent";
import { useOrganizationSettings } from "./OrganizationSettingsProvider";

interface OrganizationSettingsProps {
  organization: Organization;
  onCancel: () => void;
  isMobile: boolean;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
}

export function OrganizationSettings({
  organization,
  onCancel,
  isMobile,
  showSidebar,
  setShowSidebar,
}: OrganizationSettingsProps) {
  const { setSelectedSection } = useOrganizationSettings();

  useEffect(() => {
    setSelectedSection("basic");
  }, [setSelectedSection]);

  const isMobileOverlay = isMobile && showSidebar;

  return (
    <div className="flex h-full relative" data-testid="org-settings-container">
      {isMobileOverlay && (
        <div
          className="absolute inset-0 bg-black/50 z-40"
          onClick={() => setShowSidebar(false)}
          data-testid="settings-mobile-backdrop"
        />
      )}

      <div
        className={cn(
          "flex flex-col transition-all duration-200",
          isMobile && !showSidebar && "hidden",
          isMobileOverlay
            ? "absolute inset-y-0 left-0 z-50 w-64 bg-card shadow-lg"
            : "w-64"
        )}
        data-testid="settings-sidebar-wrapper"
      >
        <OrganizationSettingsSidebar onItemSelected={() => {
          if (isMobile) setShowSidebar(false);
        }} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden" data-testid="settings-content-wrapper">
        <OrganizationSettingsContent organization={organization} />
      </div>
    </div>
  );
}
