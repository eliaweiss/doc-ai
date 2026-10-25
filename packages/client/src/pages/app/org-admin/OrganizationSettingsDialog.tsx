"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import type { Organization } from "@zdocs/types";
import { OrganizationSettingsProvider } from "./OrganizationSettingsProvider";
import { OrganizationSettings } from "./OrganizationSettings";
import { OrganizationSettingsHeader } from "./components/OrganizationSettingsHeader";

interface OrganizationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
  onSuccess: (updatedOrganization: Organization) => void;
}

export function OrganizationSettingsDialog({
  open,
  onOpenChange,
  organization,
  onSuccess,
}: OrganizationSettingsDialogProps) {
  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[99vw] h-[99vh] flex flex-col p-0">
        <OrganizationSettingsProvider
          organization={organization}
          isOpen={open}
          onSuccess={onSuccess}
        >
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>
              <OrganizationSettingsHeader org={organization} isMobile={false} onToggleSidebar={() => {}} />
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <OrganizationSettings
              organization={organization}
              onCancel={() => onOpenChange(false)}
              isMobile={false}
              showSidebar={true}
              setShowSidebar={() => {}}
            />
          </div>
        </OrganizationSettingsProvider>
      </DialogContent>
    </Dialog>
  );
}
