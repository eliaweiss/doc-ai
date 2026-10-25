"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Building2, Cpu, Database } from "lucide-react";
import { useOrganizationSettings, type SettingsSection } from "../OrganizationSettingsProvider";
import { cn } from "../../../../lib/utils";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

interface OrganizationSettingsSidebarProps {
  onItemSelected?: () => void;
}

interface MenuItem {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrganizationSettingsSidebar({ onItemSelected }: OrganizationSettingsSidebarProps) {
  const tOrgs = useTranslations("organizations");
  const tLocal = useTranslations("localSettings");
  const tApp = useTranslations("appPage");
  const router = useRouter();
  const { selectedSection, setSelectedSection } = useOrganizationSettings();
  const { logEvent } = useLogUserJourneyEvent();

  const handleSectionClick = (sectionId: SettingsSection) => {
    setSelectedSection(sectionId);
    logEvent({
      eventType: "org_settings_section_selected",
      eventData: { section: sectionId },
    });
    onItemSelected?.();
  };

  const menuItems: MenuItem[] = [
    {
      id: "basic",
      label: tLocal("generalLabel"), // doc-ai: was the organization's "Basic Info"
      icon: Building2,
    },
    // doc-ai: Billing / Invoice History replaced by local processing settings
    {
      id: "processing",
      label: tLocal("menuLabel"),
      icon: Cpu,
    },
  ];

  return (
    <aside
      className="w-64 border-r bg-card flex flex-col"
      data-testid="org-settings-sidebar"
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
              onClick={() => handleSectionClick(item.id)}
              data-testid={`org-settings-nav-${item.id}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
        {/* doc-ai: Extraction Templates moved here from the app switcher; still opens as its own app */}
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            router.push("/schema");
            onItemSelected?.();
          }}
          data-testid="org-settings-nav-schema"
        >
          <Database className="mr-2 h-4 w-4" />
          {tApp("modeDocumentTypes")}
        </Button>
      </nav>
    </aside>
  );
}
