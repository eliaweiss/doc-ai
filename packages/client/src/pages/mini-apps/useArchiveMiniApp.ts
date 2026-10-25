"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { MiniApp } from "@zdocs/types";
import useOrgStore from "../../context-providers/orgStore";
import useAppStore from "../../context-providers/appStore";
import { useQuickAccess } from "../../context-providers/QuickAccessProvider";
import { updateMiniAppApi } from "../../utilities/api/miniAppApi";

/**
 * doc-ai: archive or restore a mini app. Archiving also unpins it from the
 * app menu; restoring leaves it unpinned. Resolves to the updated app, or
 * null on failure.
 */
export function useArchiveMiniApp() {
  const { org } = useOrgStore();
  const { updateMiniAppInList } = useAppStore();
  const { disable, isEnabled } = useQuickAccess();
  const t = useTranslations("apps");

  return useCallback(async (app: MiniApp, archived: boolean): Promise<MiniApp | null> => {
    if (!org?.id) return null;
    try {
      if (archived && isEnabled(app.id, "mini_app")) {
        await disable({ appId: app.id, appType: "mini_app" });
      }
      const updated = await updateMiniAppApi(org.id, app.id, { archived });
      updateMiniAppInList(updated);
      toast.success(t(archived ? "miniAppArchived" : "miniAppRestored", { name: app.name }));
      return updated;
    } catch {
      toast.error(t(archived ? "archiveFailed" : "restoreFailed"));
      return null;
    }
  }, [org?.id, t, isEnabled, disable, updateMiniAppInList]);
}
