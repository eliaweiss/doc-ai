import { IS_BANK_LINKS_ENABLED, IS_DATASET_ENABLED, IS_DOC_VISION, IS_QB_INTEGRATION_ENABLED, IS_XERO_INTEGRATION_ENABLED, isMobileWidth } from "@zdocs/util";
import {
  FolderOpen,
  Search,
  Wrench,
  Hammer, Database,
  DatabaseZap,
  Landmark,
  Clock, type LucideIcon,
  EclipseIcon,
  Settings,
  Plug,
} from "lucide-react";
import type { SystemAppId } from "@zdocs/types";

export type { SystemAppId };
export { DEFAULT_ENABLED_SYSTEM_APP_IDS } from "@zdocs/types";

export interface SystemApp {
  id: SystemAppId;
  icon: LucideIcon;
  docsUrl: string;
  translationKey: string;
  path: string;
  color: string; // Hex color code
  hideOnMobile?: boolean;
  isHidden?: boolean;
}


export const getSystemApps = (): SystemApp[] => {
  return SYSTEM_APPS.filter(
    (app) => app.isHidden ? false : (isMobileWidth() ? !app.hideOnMobile : true)
  );
};

const SYSTEM_APPS: SystemApp[] = [
  {
    id: "files",
    icon: FolderOpen,
    translationKey: "modeBrowse",
    docsUrl: "/docs/system-apps/browse",
    path: "/folder",
    color: "#3b82f6", // blue
  },
  {
    id: "settings",
    icon: Settings,
    translationKey: "modeSettings",
    docsUrl: "/docs/system-apps/settings",
    path: "/settings",
    color: "#ec4899", // pink
    hideOnMobile: true,
  },
  {
    id: "api-settings",
    icon: Settings,
    translationKey: "modeApiSettings",
    docsUrl: "/docs/system-apps/api-settings",
    path: "/api-settings",
    color: "#a85500", // orange
    isHidden: true, // doc-ai: no inbound webhook / API keys (local, single user)
  },
  {
    id: "search",
    icon: Search,
    translationKey: "modeSearch",
    docsUrl: "/docs/system-apps/search",
    path: "/search",
    color: "#06b6d4", // cyan
  },
  {
    id: "reconciliation/workbench",
    icon: Wrench,
    translationKey: "modeReconciliationWorkbench",
    docsUrl: "/docs/system-apps/reconciliation",
    path: "/reconciliation/workbench",
    color: "#f59e0b", // orange
    hideOnMobile: true,
  },
  {
    id: "reconciliation/ledger",
    icon: Hammer,
    translationKey: "modeReconciliationLedger",
    docsUrl: "/docs/system-apps/reconciliation",
    path: "/reconciliation/ledger",
    color: "#ef4444", // red
    hideOnMobile: true,
    isHidden: true, // doc-ai: ledger trace not ported (broken link)
  },
  // disabled for now - not ready for production
  // {
  //   id: "ai-desk",
  //   icon: Sparkles,
  //   translationKey: "modeAiDesk",
  //   path: "/ai-desk",
  //   color: "#ec4899", // pink
  // },
  {
    id: "ai-builder",
    icon: EclipseIcon,
    translationKey: "modeAiBuilder",
    docsUrl: "/docs/ai-builder/overview",
    path: "/ai-builder",
    color: "#06d49b", // cyan-green
    hideOnMobile: true,
    isHidden: true, // doc-ai: no AI builder (broken link)
  },
  {
    id: "schema",
    icon: Database,
    translationKey: "modeDocumentTypes",
    docsUrl: "/docs/system-apps/document-types",
    path: "/schema",
    color: "#a855f7", // mauve
    hideOnMobile: true,
  },
  {
    id: "tasks",
    icon: Clock,
    translationKey: "modeTasks",
    docsUrl: "/docs/system-apps/tasks",
    path: "/tasks",
    color: "#facc15", // yellow-green
    isHidden: true, // doc-ai: tasks not ported (broken link)
  },
  {
    id: "bank-links",
    icon: Landmark,
    translationKey: "modeBankLinks",
    docsUrl: "/docs/system-apps/data-sources",
    path: "/bank-links",
    color: "#0ea5e9", // sky blue
    hideOnMobile: true,
    isHidden: !IS_BANK_LINKS_ENABLED,
  },
  {
    id: "data-sources",
    icon: DatabaseZap,
    translationKey: "modeDataSources",
    docsUrl: "/docs/system-apps/data-sources",
    path: "/data-sources",
    color: "#10b981", // emerald
    hideOnMobile: true,
    isHidden: !IS_DATASET_ENABLED,
  },
  {
    id: "integrations",
    icon: Plug,
    translationKey: "modeIntegrations",
    docsUrl: "/docs",
    path: "/integrations",
    color: "#0077c5",
    hideOnMobile: false,
    isHidden: !IS_QB_INTEGRATION_ENABLED && !IS_XERO_INTEGRATION_ENABLED,
  },
];
