"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoadingDots } from "@zdocs/client-component";
import { AppAuthView } from "../AppAuthView";
import { AppHeader } from "../AppHeader";
import useOrgStore from "../../../context-providers/orgStore";
import { OrganizationSettingsProvider } from "./OrganizationSettingsProvider";
import { OrganizationSettings } from "./OrganizationSettings";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { Organization } from "@zdocs/types";
import { OrganizationSettingsHeader } from "./components/OrganizationSettingsHeader";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import { isMobileWidth } from "@zdocs/util";

export function OrganizationSettingsPage() {
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

  const handleCancel = () => {
    router.back();
  };

  const handleSuccess = async (updatedOrganization: Organization) => {
    // Update org with the fresh data from the provider
    setOrg(updatedOrganization);
    // Update organizations list
    const updatedOrganizations = organizations.map((o) =>
      o.id === updatedOrganization.id ? updatedOrganization : o
    );
    setOrganizations(updatedOrganizations);
    toast.success(tOrgs("settingsSaved") || "Settings saved successfully");
    logEvent({
      eventType: "org_settings_saved",
      eventData: { orgId: updatedOrganization.id },
    });
  };

  // Log page view when org is loaded
  useEffect(() => {
    if (org?.id) {
      logEvent({
        eventType: "org_settings_page_viewed",
        eventData: { orgId: org.id },
      });
    }
  }, [org?.id, logEvent]);


  // Loading state
  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="org-settings-page-loading"
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
        data-testid="org-settings-org-loading"
      >
        <LoadingDots message="Loading organization settings..." />
      </div>
    );
  }

  // Authenticated and org loaded - show settings
  return (
    <div
      className="h-full bg-background flex flex-col overflow-hidden"
      data-testid="org-settings-page-main"
    >
      <AppHeader />

      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        data-testid="org-settings-page-content"
      >
        <OrganizationSettingsProvider
          organization={org}
          isOpen={true}
          onSuccess={handleSuccess}
        >
          <OrganizationSettingsHeader
            org={org}
            isMobile={isMobile}
            onToggleSidebar={() => setShowSidebar(prev => !prev)}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <OrganizationSettings
              organization={org}
              onCancel={handleCancel}
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

export default OrganizationSettingsPage;
