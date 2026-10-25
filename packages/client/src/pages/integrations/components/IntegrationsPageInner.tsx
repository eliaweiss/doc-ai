"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import useOrgStore from "../../../context-providers/orgStore";
import { IntegrationCard } from "./IntegrationCard";
import { quickbooksIntegration } from "./quickbooksIntegration";
import { xeroIntegration } from "./xeroIntegration";
import type { IntegrationDefinition } from "./IntegrationDefinition";

export const INTEGRATIONS: IntegrationDefinition[] = [
  quickbooksIntegration,
  xeroIntegration,
];

export function IntegrationsPageInner() {
  const t = useTranslations("apps.integrations");
  const { org } = useOrgStore();
  const orgId = org?.id;

  if (!orgId) {
    return (
      <div
        className="flex flex-1 items-center justify-center py-12 text-muted-foreground text-sm"
        data-testid="integrations-page-org-loading"
      >
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-muted-foreground" />
      </div>
    );
  }

  const enabledIntegrations = INTEGRATIONS.filter((def) => def.enabled);

  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-6"
      data-testid="integrations-page-root"
    >
      <div data-testid="integrations-page-intro">
        <h2 className="text-xl font-semibold text-foreground">
          {t("pageTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("pageDescription")}
        </p>
      </div>

      {enabledIntegrations.map((def) => (
        <IntegrationCard key={def.id} definition={def} orgId={orgId} />
      ))}
    </div>
  );
}
