"use client";

import { useTranslations } from "next-intl";
import { Organization } from "@zdocs/types";
import { Button } from "@zdocs/client-component";
import { Menu } from "lucide-react";
import { useOrganizationSettings } from "../OrganizationSettingsProvider";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

interface OrganizationSettingsHeaderProps {
  org: Organization;
  isMobile: boolean;
  onToggleSidebar: () => void;
}

export function OrganizationSettingsHeader({ org, isMobile, onToggleSidebar }: OrganizationSettingsHeaderProps) {
  const tOrgs = useTranslations("organizations");
  const tLocal = useTranslations("localSettings");
  const { editName, isSaving, handleUpdateOrg, selectedSection } = useOrganizationSettings();
  const { logEvent } = useLogUserJourneyEvent();

  const handleSave = async () => {
    logEvent({
      eventType: "org_settings_save_clicked",
      eventData: { orgId: org.id },
    });
    // handleUpdateOrg calls onClose after saving; the settings page has nothing to close
    await handleUpdateOrg(() => {});
  };

  return (
    // doc-ai: no organization name / color in the UI
    <div
      className="p-4 border-b flex items-center justify-between"
      data-testid="org-settings-sidebar-header"
    >
      <div className="flex items-center gap-2 flex-1" data-testid="org-settings-header-left">
        {isMobile && (
          <button
            onClick={onToggleSidebar}
            className="p-2 border border-border rounded-md shadow-sm hover:bg-accent transition-colors"
            data-testid="settings-mobile-hamburger-btn"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <div className="flex-1" data-testid="org-settings-header-info">
          <h2 className="text-lg font-semibold text-card-foreground">
            {tLocal("pageTitle")}
          </h2>
        </div>
      </div>

      {/* doc-ai: the Processing section saves itself */}
      {selectedSection !== "processing" && (
        <Button onClick={handleSave} disabled={isSaving || !(editName || org.name)?.trim()}>
          {isSaving ? tOrgs("saving") : tOrgs("save")}
        </Button>
      )}
    </div>
  );
}
