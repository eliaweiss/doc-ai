"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { MiniApp } from "@zdocs/types";
import useOrgStore from "../../context-providers/orgStore";
import useAppStore from "../../context-providers/appStore";
import { useQuickAccess } from "../../context-providers/QuickAccessProvider";
import { useConfirm } from "../../context-providers/confirm-provider/ConfirmProvider";
import { deleteMiniAppApi } from "../../utilities/api/miniAppApi";

/**
 * doc-ai: confirm, then delete a mini app (and unpin it from the app menu).
 * Resolves true when the app was deleted.
 */
export function useDeleteMiniApp() {
  const { org } = useOrgStore();
  const { refreshMiniApps } = useAppStore();
  const { disable, isEnabled } = useQuickAccess();
  const confirm = useConfirm();
  const t = useTranslations("aiBuilder");

  return useCallback(async (app: MiniApp): Promise<boolean> => {
    if (!org?.id) return false;
    const confirmed = await confirm({
      title: t("deleteMiniAppTitle"),
      message: t("deleteMiniAppConfirmation", { name: app.name }),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
    });
    if (!confirmed) return false;

    try {
      // Quick access rows reference mini apps without a foreign key
      if (isEnabled(app.id, "mini_app")) {
        await disable({ appId: app.id, appType: "mini_app" });
      }
      await deleteMiniAppApi(org.id, app.id);
      await refreshMiniApps(org.id);
      toast.success(t("miniAppDeleted"));
      return true;
    } catch {
      toast.error(t("deleteMiniAppFailed"));
      return false;
    }
  }, [org?.id, confirm, t, isEnabled, disable, refreshMiniApps]);
}
