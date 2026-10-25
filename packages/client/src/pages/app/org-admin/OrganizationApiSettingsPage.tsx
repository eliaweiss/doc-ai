"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../AppAuthView";
import { AppHeader } from "../AppHeader";
import useOrgStore from "../../../context-providers/orgStore";
import { OrganizationSettingsProvider, useOrganizationSettings } from "./OrganizationSettingsProvider";
import { OrganizationApiSettings } from "./OrganizationApiSettings";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { Organization } from "@zdocs/types";
import { Button } from "@zdocs/client-component";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import { isMobileWidth } from "@zdocs/util";

interface ApiSettingsHeaderProps {
  tOrgs: ReturnType<typeof useTranslations<"organizations">>;
  isMobile: boolean;
  onToggleSidebar: () => void;
}

function ApiSettingsHeader({ tOrgs, isMobile, onToggleSidebar }: ApiSettingsHeaderProps) {
  const { isSaving, saveOrg } = useOrganizationSettings();
  const { logEvent } = useLogUserJourneyEvent();

  const handleSave = async () => {
    await logEvent({
      eventType: "org_api_settings_save_clicked",
    });
    await saveOrg();
  };

  return (
    <div
      className="p-4 border-b shrink-0 flex items-center justify-between"
      data-testid="org-settings-sidebar-header"
    >
      <div className="flex items-center gap-2" data-testid="org-settings-header-left">
        {isMobile && (
          <button
            onClick={onToggleSidebar}
            className="p-2 border border-border rounded-md shadow-sm hover:bg-accent transition-colors"
            data-testid="api-settings-mobile-hamburger-btn"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <p className="text-lg font-semibold text-card-foreground">
          {tOrgs("apiSettings")}
        </p>
      </div>
      <Button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? tOrgs("saving") : tOrgs("save")}
      </Button>
    </div>
  );
}

export function OrganizationApiSettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { org, setOrg, organizations, setOrganizations } = useOrgStore();
  const tOrgs = useTranslations("organizations");
  const { logEvent } = useLogUserJourneyEvent();
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(() => isMobileWidth());

  useEffect(() => {
    setIsMobile(isMobileWidth());

    const handleResize = () => {
      const mobile = isMobileWidth();
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="org-api-settings-page-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  // Not authenticated - show login/register
  if (status === "unauthenticated") {
    return <AppAuthView />;
  }

  // Wait for org to be loaded
  if (!org?.id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="org-api-settings-org-loading"
      >
        <LoadingDots message="Loading organization API settings..." />
      </div>
    );
  }

  const handleSuccess = async (updatedOrganization: Organization) => {
    // Update org with the fresh data from the provider
    setOrg(updatedOrganization);
    // Update organizations list
    const updatedOrganizations = organizations.map((o) =>
      o.id === updatedOrganization.id ? updatedOrganization : o
    );
    setOrganizations(updatedOrganizations);
    toast.success(tOrgs("settingsSaved") || "Settings saved successfully");
  };

  // Authenticated and org loaded - show settings
  useEffect(() => {
    if (org?.id) {
      logEvent({
        eventType: "org_api_settings_page_viewed",
        eventData: {
          orgId: org.id,
        },
      });
    }
  }, [org?.id, logEvent]);

  return (
    <div
      className="h-full bg-background flex flex-col overflow-hidden"
      data-testid="org-api-settings-page-main"
    >
      <AppHeader />

      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="org-api-settings-page-content"
      >
        <OrganizationSettingsProvider
          organization={org}
          isOpen={true}
          onSuccess={handleSuccess}
        >
          <ApiSettingsHeader
            tOrgs={tOrgs}
            isMobile={isMobile}
            onToggleSidebar={() => setShowSidebar(prev => !prev)}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <OrganizationApiSettings
              organization={org}
              isMobile={isMobile}
              showSidebar={showSidebar}
              setShowSidebar={setShowSidebar}
            />
          </div>
        </OrganizationSettingsProvider>
      </main>
    </div>
  );
}

export default OrganizationApiSettingsPage;
