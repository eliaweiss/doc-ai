"use client";

import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Send } from "lucide-react";
import { useOrganizationSettings, type SettingsSection } from "../OrganizationSettingsProvider";
import { cn } from "../../../../lib/utils";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

interface OrganizationApiSettingsSidebarProps {
  onItemSelected?: () => void;
}

interface MenuItem {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrganizationApiSettingsSidebar({ onItemSelected }: OrganizationApiSettingsSidebarProps) {
  const tOrgs = useTranslations("organizations");
  const { selectedSection, setSelectedSection } = useOrganizationSettings();
  const { logEvent } = useLogUserJourneyEvent();

  const menuItems: MenuItem[] = [
    {
      id: "outbound-webhooks",
      label: tOrgs("outboundWebhookTitle") || "Outbound Webhooks",
      icon: Send,
    },
  ];

  return (
    <aside
      className="flex-1 border-r bg-card flex flex-col"
      data-testid="org-api-settings-sidebar"
    >
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedSection === item.id;
          return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-secondary text-secondary-foreground"
                )}
                onClick={() => {
                  if (!isActive) {
                    logEvent({
                      eventType: "org_api_settings_section_selected",
                      eventData: {
                        section: item.id,
                      },
                    });
                  }
                  setSelectedSection(item.id);
                  onItemSelected?.();
                }}
                data-testid={`org-api-settings-nav-${item.id}`}
              >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
