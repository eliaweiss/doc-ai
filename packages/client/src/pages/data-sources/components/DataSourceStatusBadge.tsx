"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@zdocs/client-component";
import type { DataSourceStatus } from "@zdocs/types";

interface DataSourceStatusBadgeProps {
  status: DataSourceStatus;
}

export function DataSourceStatusBadge({ status }: DataSourceStatusBadgeProps) {
  const t = useTranslations("dataSources");

  const config: Record<
    DataSourceStatus,
    { label: string; className: string }
  > = {
    SETUP: {
      label: t("statusSetup"),
      className: "bg-blue-500/20 text-blue-500 border-blue-500/30",
    },
    ACTIVE: {
      label: t("statusActive"),
      className: "bg-green-500/20 text-green-500 border-green-500/30",
    },
    ERROR: {
      label: t("statusError"),
      className: "bg-red-500/20 text-red-500 border-red-500/30",
    },
    DISABLED: {
      label: t("statusDisabled"),
      className: "bg-muted text-muted-foreground",
    },
  };

  const { label, className } = config[status];

  return (
    <Badge
      variant="outline"
      className={className}
      data-testid={`data-source-status-${status}`}
    >
      {label}
    </Badge>
  );
}
