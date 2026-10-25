"use client";

import type { Organization } from "@zdocs/types";
import { OutboundWebhookSection } from "./OutboundWebhookSection";

interface OrganizationApiSettingsContentProps {
  organization: Organization;
}

// doc-ai: no inbound API, email uploads or API keys; outbound webhooks only
export function OrganizationApiSettingsContent({
  organization: _organization,
}: OrganizationApiSettingsContentProps) {
  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      data-testid="org-api-settings-content"
    >
      <OutboundWebhookSection />
    </div>
  );
}
