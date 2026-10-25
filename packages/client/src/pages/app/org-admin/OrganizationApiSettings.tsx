"use client";

import { useEffect } from "react";
import type { Organization } from "@zdocs/types";
import { cn } from "@zdocs/util";
import { OrganizationApiSettingsSidebar } from "./components/OrganizationApiSettingsSidebar";
import { OrganizationApiSettingsContent } from "./components/OrganizationApiSettingsContent";
import { useOrganizationSettings } from "./OrganizationSettingsProvider";

interface OrganizationApiSettingsProps {
  organization: Organization;
  isMobile: boolean;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
}

export function OrganizationApiSettings({
  organization,
  isMobile,
  showSidebar,
  setShowSidebar,
}: OrganizationApiSettingsProps) {
  const { setSelectedSection } = useOrganizationSettings();

  useEffect(() => {
    setSelectedSection("outbound-webhooks");
  }, [setSelectedSection]);

  const isMobileOverlay = isMobile && showSidebar;

  return (
    <div className="flex h-full relative" data-testid="org-api-settings-container">
      {isMobileOverlay && (
        <div
          className="absolute inset-0 bg-black/50 z-40"
          onClick={() => setShowSidebar(false)}
          data-testid="api-settings-mobile-backdrop"
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
        data-testid="api-settings-sidebar-wrapper"
      >
        <OrganizationApiSettingsSidebar onItemSelected={() => {
          if (isMobile) setShowSidebar(false);
        }} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden" data-testid="api-settings-content-wrapper">
        <OrganizationApiSettingsContent organization={organization} />
      </div>
    </div>
  );
}
